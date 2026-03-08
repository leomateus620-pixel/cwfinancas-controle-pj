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
    // Validate user auth
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

    // Verify user identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json().catch(() => ({}));
    const connectionId: string | null = body.connection_id || null;
    const scope: string = body.scope || "ALL";

    console.log(`[reset-sheet-data] userId=${userId} connectionId=${connectionId} scope=${scope}`);

    // Use service role client for deletions (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const deleted: Record<string, number> = {};
    const errors: Array<{ table: string; error: string }> = [];

    // Helper to delete and count
    const deleteFrom = async (table: string, query: ReturnType<ReturnType<typeof admin.from>["delete"]>) => {
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

    const shouldDeleteTransactions = scope === "ALL" || scope === "TRANSACTIONS_ONLY";
    const shouldDeleteDRE = scope === "ALL" || scope === "DRE_ONLY";

    // --- TRANSACTIONS & RELATED (scope ALL or TRANSACTIONS_ONLY) ---
    if (shouldDeleteTransactions) {
      // 1. Get transaction IDs first (for flags cleanup)
      let transactionIds: string[] = [];
      if (connectionId) {
        const { data } = await admin
          .from("transactions")
          .select("id")
          .eq("source_sheet_id", connectionId)
          .eq("user_id", userId);
        transactionIds = (data || []).map((t: { id: string }) => t.id);
      } else {
        // Reset total: only imported transactions (source_sheet_id is not null)
        const { data } = await admin
          .from("transactions")
          .select("id")
          .eq("user_id", userId)
          .not("source_sheet_id", "is", null);
        transactionIds = (data || []).map((t: { id: string }) => t.id);
      }

      // 2. Delete transaction_flags for those transactions
      if (transactionIds.length > 0) {
        // Delete in batches of 100
        let flagsDeleted = 0;
        for (let i = 0; i < transactionIds.length; i += 100) {
          const batch = transactionIds.slice(i, i + 100);
          const { data, error } = await admin
            .from("transaction_flags")
            .delete()
            .in("transaction_id", batch)
            .select("id");
          if (!error) flagsDeleted += (data?.length ?? 0);
        }
        deleted["transaction_flags"] = flagsDeleted;
        console.log(`[reset-sheet-data] Deleted ${flagsDeleted} transaction_flags`);
      } else {
        deleted["transaction_flags"] = 0;
      }

      // 3. Delete transactions
      if (connectionId) {
        await deleteFrom(
          "transactions",
          admin.from("transactions").delete().eq("source_sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "transactions",
          admin.from("transactions").delete().eq("user_id", userId).not("source_sheet_id", "is", null)
        );
      }

      // 4. Delete financial_daily_aggregates
      if (connectionId) {
        await deleteFrom(
          "financial_daily_aggregates",
          admin.from("financial_daily_aggregates").delete().eq("source_sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "financial_daily_aggregates",
          admin.from("financial_daily_aggregates").delete().eq("user_id", userId)
        );
      }

      // 4b. Delete accounts_payable_receivable
      if (connectionId) {
        await deleteFrom(
          "accounts_payable_receivable",
          admin.from("accounts_payable_receivable").delete().eq("connection_id", connectionId).eq("user_id", userId)
        );
        // Also clean orphaned records with NULL connection_id
        await deleteFrom(
          "accounts_payable_receivable (orphans)",
          admin.from("accounts_payable_receivable").delete().is("connection_id", null).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "accounts_payable_receivable",
          admin.from("accounts_payable_receivable").delete().eq("user_id", userId)
        );
      }

      // 4c. Delete bank_balances
      if (connectionId) {
        await deleteFrom(
          "bank_balances",
          admin.from("bank_balances").delete().eq("connection_id", connectionId).eq("user_id", userId)
        );
        // Also clean orphaned records with NULL connection_id
        await deleteFrom(
          "bank_balances (orphans)",
          admin.from("bank_balances").delete().is("connection_id", null).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "bank_balances",
          admin.from("bank_balances").delete().eq("user_id", userId)
        );
      }
    }

    // --- DRE (scope ALL or DRE_ONLY) ---
    if (shouldDeleteDRE) {
      // 5. Delete dre_lines (via period_id or directly)
      if (connectionId) {
        // Get period IDs for this connection
        const { data: periods } = await admin
          .from("dre_periods")
          .select("id")
          .eq("sheet_id", connectionId)
          .eq("user_id", userId);
        const periodIds = (periods || []).map((p: { id: string }) => p.id);
        
        if (periodIds.length > 0) {
          let linesDeleted = 0;
          for (let i = 0; i < periodIds.length; i += 100) {
            const batch = periodIds.slice(i, i + 100);
            const { data, error } = await admin
              .from("dre_lines")
              .delete()
              .in("period_id", batch)
              .eq("user_id", userId)
              .select("id");
            if (!error) linesDeleted += (data?.length ?? 0);
          }
          deleted["dre_lines"] = linesDeleted;
        } else {
          deleted["dre_lines"] = 0;
        }
      } else {
        await deleteFrom(
          "dre_lines",
          admin.from("dre_lines").delete().eq("user_id", userId)
        );
      }

      // 6. Delete dre_periods
      if (connectionId) {
        await deleteFrom(
          "dre_periods",
          admin.from("dre_periods").delete().eq("sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "dre_periods",
          admin.from("dre_periods").delete().eq("user_id", userId)
        );
      }

      // 7. Delete dre_values
      if (connectionId) {
        await deleteFrom(
          "dre_values",
          admin.from("dre_values").delete().eq("sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "dre_values",
          admin.from("dre_values").delete().eq("user_id", userId)
        );
      }

      // 8. Delete dre_mappings
      if (connectionId) {
        await deleteFrom(
          "dre_mappings",
          admin.from("dre_mappings").delete().eq("sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "dre_mappings",
          admin.from("dre_mappings").delete().eq("user_id", userId)
        );
      }
    }

    // --- PROFILES & INSIGHTS (scope ALL only) ---
    if (scope === "ALL") {
      // 9. Delete ai_sheet_profiles
      if (connectionId) {
        await deleteFrom(
          "ai_sheet_profiles",
          admin.from("ai_sheet_profiles").delete().eq("connected_sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "ai_sheet_profiles",
          admin.from("ai_sheet_profiles").delete().eq("user_id", userId)
        );
      }

      // 10. Delete ai_insights
      if (connectionId) {
        await deleteFrom(
          "ai_insights",
          admin.from("ai_insights").delete().eq("connected_sheet_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "ai_insights",
          admin.from("ai_insights").delete().eq("user_id", userId)
        );
      }

      // 11. Delete sheet_sync_jobs
      if (connectionId) {
        await deleteFrom(
          "sheet_sync_jobs",
          admin.from("sheet_sync_jobs").delete().eq("connection_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "sheet_sync_jobs",
          admin.from("sheet_sync_jobs").delete().eq("user_id", userId)
        );
      }

      // 12. Delete google_sheet_sync_logs
      if (connectionId) {
        await deleteFrom(
          "google_sheet_sync_logs",
          admin.from("google_sheet_sync_logs").delete().eq("connection_id", connectionId)
        );
      } else {
        // For total reset, get all connection IDs for user first
        const { data: conns } = await admin
          .from("google_sheet_connections")
          .select("id")
          .eq("user_id", userId);
        const connIds = (conns || []).map((c: { id: string }) => c.id);
        if (connIds.length > 0) {
          let logsDeleted = 0;
          for (let i = 0; i < connIds.length; i += 100) {
            const batch = connIds.slice(i, i + 100);
            const { data, error } = await admin
              .from("google_sheet_sync_logs")
              .delete()
              .in("connection_id", batch)
              .select("id");
            if (!error) logsDeleted += (data?.length ?? 0);
          }
          deleted["google_sheet_sync_logs"] = logsDeleted;
        } else {
        deleted["google_sheet_sync_logs"] = 0;
        }
      }

      // 13. Delete sync_tab_audit
      if (connectionId) {
        await deleteFrom(
          "sync_tab_audit",
          admin.from("sync_tab_audit").delete().eq("connection_id", connectionId).eq("user_id", userId)
        );
      } else {
        await deleteFrom(
          "sync_tab_audit",
          admin.from("sync_tab_audit").delete().eq("user_id", userId)
        );
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
