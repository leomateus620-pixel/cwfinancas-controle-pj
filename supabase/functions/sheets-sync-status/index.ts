import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface SyncStatusRequest {
  connection_id?: string;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    
    let body: SyncStatusRequest = {};
    try {
      body = await req.json();
    } catch {
      // Allow empty body for GET-like behavior
    }
    
    const { connection_id, limit = 10 } = body;

    // Build query for sync logs
    let query = supabase
      .from("google_sheet_sync_logs")
      .select(`
        id,
        connection_id,
        started_at,
        completed_at,
        status,
        mode,
        rows_processed,
        rows_imported,
        rows_upserted,
        rows_updated,
        rows_skipped,
        errors,
        error_details,
        google_revision,
        retry_count,
        google_sheet_connections!inner(
          id,
          user_id,
          spreadsheet_name,
          sheet_name
        )
      `)
      .eq("google_sheet_connections.user_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (connection_id) {
      query = query.eq("connection_id", connection_id);
    }

    const { data: syncLogs, error: logsError } = await query;

    if (logsError) {
      console.error("Error fetching sync logs:", logsError);
      throw new Error("Failed to fetch sync status");
    }

    // Get summary stats for each connection
    const { data: connections, error: connError } = await supabase
      .from("google_sheet_connections")
      .select(`
        id,
        spreadsheet_name,
        sheet_name,
        sync_status,
        last_sync_at,
        auto_sync_enabled,
        auto_sync_interval
      `)
      .eq("user_id", userId);

    if (connError) {
      console.error("Error fetching connections:", connError);
    }

    // Calculate aggregate stats
    const stats = {
      total_syncs: syncLogs?.length || 0,
      successful_syncs: syncLogs?.filter(s => s.status === "success").length || 0,
      partial_syncs: syncLogs?.filter(s => s.status === "partial").length || 0,
      failed_syncs: syncLogs?.filter(s => s.status === "error").length || 0,
      total_rows_imported: syncLogs?.reduce((acc, s) => acc + (s.rows_imported || 0), 0) || 0,
      total_rows_upserted: syncLogs?.reduce((acc, s) => acc + (s.rows_upserted || 0), 0) || 0,
    };

    // Format runs for response
    const runs = syncLogs?.map(log => ({
      id: log.id,
      connection_id: log.connection_id,
      spreadsheet_name: log.google_sheet_connections?.spreadsheet_name,
      sheet_name: log.google_sheet_connections?.sheet_name,
      started_at: log.started_at,
      finished_at: log.completed_at,
      status: log.status,
      mode: log.mode || "MANUAL",
      rows_read: log.rows_processed || 0,
      rows_upserted: log.rows_upserted || log.rows_imported || 0,
      rows_updated: log.rows_updated || 0,
      rows_failed: log.rows_skipped || 0,
      errors: log.errors || [],
      google_revision: log.google_revision,
    })) || [];

    return new Response(
      JSON.stringify({
        runs,
        connections: connections || [],
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in sheets-sync-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
