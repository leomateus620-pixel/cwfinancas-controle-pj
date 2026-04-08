import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const connectionId: string | null = body.connection_id || null;
    const scope: string = body.scope || "ALL";

    console.log(`[reset-sheet-data] userId=${userId} connectionId=${connectionId} scope=${scope}`);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const deleted: Record<string, number> = {};
    const errors: Array<{ table: string; error: string }> = [];

    const deleteFrom = async (table: string, query: any) => {
      const { data, error } = await query.select("id");
      if (error) {
        console.error(`[reset-sheet-data] Error deleting from ${table}:`, error.message);
        errors.push({ table, error: error.message });
        deleted[table] = 0;
      } else {
        deleted[table] = data?.length ?? 0;
        console.log(`[reset-sheet-data] Deleted ${deleted[table]} from ${table}`);
      }
    };

    const deleteBatched = async (table: string, column: string, ids: string[], extraFilter?: (q: any) => any) => {
      let total = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        let q = admin.from(table).delete().in(column, batch);
        if (extraFilter) q = extraFilter(q);
        const { data, error } = await q.select("id");
        if (!error) total += (data?.length ?? 0);
      }
      deleted[table] = (deleted[table] ?? 0) + total;
      console.log(`[reset-sheet-data] Deleted ${total} from ${table}`);
    };

    const shouldDeleteTransactions = scope === "ALL" || scope === "TRANSACTIONS_ONLY";
    const shouldDeleteDRE = scope === "ALL" || scope === "DRE_ONLY";

    // ── CREDIT CARD (scope ALL or TRANSACTIONS_ONLY) ──
    if (shouldDeleteTransactions) {
      // 1. credit_card_review_queue
      if (connectionId) {
        // Get cycle IDs for this connection, then get transaction IDs, then delete review queue
        const { data: cycles } = await admin.from("credit_card_cycles").select("id").eq("connection_id", connectionId).eq("user_id", userId);
        const cycleIds = (cycles || []).map((c: { id: string }) => c.id);
        if (cycleIds.length > 0) {
          // Get transaction_ids from cc_transactions in these cycles
          const { data: ccTxs } = await admin.from("credit_card_transactions").select("transaction_id").in("cycle_id", cycleIds).eq("user_id", userId);
          const txIds = (ccTxs || []).filter((t: any) => t.transaction_id).map((t: any) => t.transaction_id);
          if (txIds.length > 0) {
            await deleteBatched("credit_card_review_queue", "transaction_id", txIds);
          }
          // 2. credit_card_transactions
          await deleteBatched("credit_card_transactions", "cycle_id", cycleIds);
        }
        // 3. credit_card_cycles
        await deleteFrom("credit_card_cycles", admin.from("credit_card_cycles").delete().eq("connection_id", connectionId).eq("user_id", userId));
      } else {
        // Total reset
        await deleteFrom("credit_card_review_queue", admin.from("credit_card_review_queue").delete().eq("user_id", userId));
        await deleteFrom("credit_card_transactions", admin.from("credit_card_transactions").delete().eq("user_id", userId));
        await deleteFrom("credit_card_cycles", admin.from("credit_card_cycles").delete().eq("user_id", userId));
      }

      // 4. Get transaction IDs for flags cleanup
      let transactionIds: string[] = [];
      if (connectionId) {
        const { data } = await admin.from("transactions").select("id").eq("source_sheet_id", connectionId).eq("user_id", userId);
        transactionIds = (data || []).map((t: { id: string }) => t.id);
      } else {
        // Total reset: get ALL transactions (not just those with source_sheet_id)
        const { data } = await admin.from("transactions").select("id").eq("user_id", userId);
        transactionIds = (data || []).map((t: { id: string }) => t.id);
      }

      // 5. transaction_flags
      if (transactionIds.length > 0) {
        await deleteBatched("transaction_flags", "transaction_id", transactionIds);
      } else {
        deleted["transaction_flags"] = 0;
      }

      // 6. transactions
      if (connectionId) {
        await deleteFrom("transactions", admin.from("transactions").delete().eq("source_sheet_id", connectionId).eq("user_id", userId));
      } else {
        // Total reset: delete ALL transactions (including orphans with NULL source_sheet_id)
        await deleteFrom("transactions", admin.from("transactions").delete().eq("user_id", userId));
      }

      // 7. financial_daily_aggregates
      if (connectionId) {
        await deleteFrom("financial_daily_aggregates", admin.from("financial_daily_aggregates").delete().eq("source_sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("financial_daily_aggregates", admin.from("financial_daily_aggregates").delete().eq("user_id", userId));
      }

      // 8. accounts_payable_receivable
      if (connectionId) {
        await deleteFrom("accounts_payable_receivable", admin.from("accounts_payable_receivable").delete().eq("connection_id", connectionId).eq("user_id", userId));
        await deleteFrom("accounts_payable_receivable (orphans)", admin.from("accounts_payable_receivable").delete().is("connection_id", null).eq("user_id", userId));
      } else {
        await deleteFrom("accounts_payable_receivable", admin.from("accounts_payable_receivable").delete().eq("user_id", userId));
      }

      // 9. bank_balances
      if (connectionId) {
        await deleteFrom("bank_balances", admin.from("bank_balances").delete().eq("connection_id", connectionId).eq("user_id", userId));
        await deleteFrom("bank_balances (orphans)", admin.from("bank_balances").delete().is("connection_id", null).eq("user_id", userId));
      } else {
        await deleteFrom("bank_balances", admin.from("bank_balances").delete().eq("user_id", userId));
      }
    }

    // ── DRE (scope ALL or DRE_ONLY) ──
    if (shouldDeleteDRE) {
      if (connectionId) {
        const { data: periods } = await admin.from("dre_periods").select("id").eq("sheet_id", connectionId).eq("user_id", userId);
        const periodIds = (periods || []).map((p: { id: string }) => p.id);
        if (periodIds.length > 0) {
          await deleteBatched("dre_lines", "period_id", periodIds, (q: any) => q.eq("user_id", userId));
        } else {
          deleted["dre_lines"] = 0;
        }
      } else {
        await deleteFrom("dre_lines", admin.from("dre_lines").delete().eq("user_id", userId));
      }

      if (connectionId) {
        await deleteFrom("dre_periods", admin.from("dre_periods").delete().eq("sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("dre_periods", admin.from("dre_periods").delete().eq("user_id", userId));
      }

      if (connectionId) {
        await deleteFrom("dre_values", admin.from("dre_values").delete().eq("sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("dre_values", admin.from("dre_values").delete().eq("user_id", userId));
      }

      if (connectionId) {
        await deleteFrom("dre_mappings", admin.from("dre_mappings").delete().eq("sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("dre_mappings", admin.from("dre_mappings").delete().eq("user_id", userId));
      }
    }

    // ── PROFILES, INSIGHTS, FORECASTS, INVOICES (scope ALL) ──
    if (scope === "ALL") {
      // ai_sheet_profiles
      if (connectionId) {
        await deleteFrom("ai_sheet_profiles", admin.from("ai_sheet_profiles").delete().eq("connected_sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("ai_sheet_profiles", admin.from("ai_sheet_profiles").delete().eq("user_id", userId));
      }

      // ai_insights
      if (connectionId) {
        await deleteFrom("ai_insights", admin.from("ai_insights").delete().eq("connected_sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("ai_insights", admin.from("ai_insights").delete().eq("user_id", userId));
      }

      // sheet_sync_jobs
      if (connectionId) {
        await deleteFrom("sheet_sync_jobs", admin.from("sheet_sync_jobs").delete().eq("connection_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("sheet_sync_jobs", admin.from("sheet_sync_jobs").delete().eq("user_id", userId));
      }

      // google_sheet_sync_logs
      if (connectionId) {
        await deleteFrom("google_sheet_sync_logs", admin.from("google_sheet_sync_logs").delete().eq("connection_id", connectionId));
      } else {
        const { data: conns } = await admin.from("google_sheet_connections").select("id").eq("user_id", userId);
        const connIds = (conns || []).map((c: { id: string }) => c.id);
        if (connIds.length > 0) {
          await deleteBatched("google_sheet_sync_logs", "connection_id", connIds);
        } else {
          deleted["google_sheet_sync_logs"] = 0;
        }
      }

      // sync_tab_audit
      if (connectionId) {
        await deleteFrom("sync_tab_audit", admin.from("sync_tab_audit").delete().eq("connection_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("sync_tab_audit", admin.from("sync_tab_audit").delete().eq("user_id", userId));
      }

      // ── NEW: forecast_monthly ──
      if (connectionId) {
        await deleteFrom("forecast_monthly", admin.from("forecast_monthly").delete().eq("sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("forecast_monthly", admin.from("forecast_monthly").delete().eq("user_id", userId));
      }

      // ── NEW: forecast_insights ──
      if (connectionId) {
        await deleteFrom("forecast_insights", admin.from("forecast_insights").delete().eq("sheet_id", connectionId).eq("user_id", userId));
      } else {
        await deleteFrom("forecast_insights", admin.from("forecast_insights").delete().eq("user_id", userId));
      }

      // ── NEW: invoices ──
      if (connectionId) {
        // invoices don't have connection_id, so on specific connection reset we skip
        deleted["invoices"] = 0;
      } else {
        await deleteFrom("invoices", admin.from("invoices").delete().eq("user_id", userId));
      }
    }

    const hasErrors = errors.length > 0;
    console.log(`[reset-sheet-data] Done. Deleted:`, deleted, `Errors:`, errors);

    return new Response(
      JSON.stringify({
        ok: !hasErrors,
        deleted,
        errors: hasErrors ? errors : undefined,
      }),
      {
        status: hasErrors ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[reset-sheet-data] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
