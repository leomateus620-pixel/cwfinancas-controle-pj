import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

// Allowed sync windows (America/Sao_Paulo): 07:30, 09:30, 11:00, 13:30, 15:00, 17:00
const SYNC_WINDOWS_BRT = [
  { h: 7, m: 30 }, { h: 9, m: 30 }, { h: 11, m: 0 },
  { h: 13, m: 30 }, { h: 15, m: 0 }, { h: 17, m: 0 },
];
const WINDOW_TOLERANCE_MIN = 10; // Execute if within 10 minutes of a scheduled window

function isWithinSyncWindow(): boolean {
  // Get current time in BRT (UTC-3)
  const now = new Date();
  const brtOffset = -3 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const brtMinutes = utcMinutes + brtOffset + (utcMinutes + brtOffset < 0 ? 1440 : 0);
  const brtH = Math.floor(brtMinutes / 60) % 24;
  const brtM = brtMinutes % 60;

  for (const w of SYNC_WINDOWS_BRT) {
    const windowMin = w.h * 60 + w.m;
    const currentMin = brtH * 60 + brtM;
    const diff = Math.abs(currentMin - windowMin);
    if (diff <= WINDOW_TOLERANCE_MIN || (1440 - diff) <= WINDOW_TOLERANCE_MIN) {
      return true;
    }
  }
  return false;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { access_token: data.access_token, expires_at: expiresAt };
}

async function getDriveModifiedTime(accessToken: string, spreadsheetId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=modifiedTime&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.modifiedTime || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] scheduled-sync started`);

  try {
    // ===== Security: validate X-CRON-SECRET =====
    const headerSecret = req.headers.get("x-cron-secret");
    if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
      console.warn(`[${requestId}] Unauthorized: invalid or missing x-cron-secret`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Fallback window check =====
    if (!isWithinSyncWindow()) {
      console.log(`[${requestId}] Outside sync window, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: "outside_sync_window" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ===== Fetch all connections with auto_sync_enabled =====
    const now = new Date().toISOString();
    const { data: connections, error: connError } = await supabase
      .from("google_sheet_connections")
      .select("id, user_id, spreadsheet_id, spreadsheet_name, refresh_token, access_token, token_expires_at, last_source_fingerprint, lock_until")
      .eq("auto_sync_enabled", true)
      .or(`lock_until.is.null,lock_until.lt.${now}`);

    if (connError) {
      console.error(`[${requestId}] Failed to fetch connections:`, connError);
      return new Response(JSON.stringify({ error: connError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Found ${connections?.length || 0} eligible connections`);

    const results: Array<{ connection_id: string; spreadsheet_name: string; status: string; reason?: string }> = [];

    for (const conn of connections || []) {
      try {
        console.log(`[${requestId}] Processing connection ${conn.id} (${conn.spreadsheet_name})`);

        // Refresh token if needed
        let accessToken = conn.access_token;
        const tokenExpired = !conn.token_expires_at || new Date(conn.token_expires_at) < new Date();
        if (tokenExpired || !accessToken) {
          try {
            const refreshed = await refreshAccessToken(conn.refresh_token);
            accessToken = refreshed.access_token;
            await supabase.from("google_sheet_connections").update({
              access_token: refreshed.access_token, token_expires_at: refreshed.expires_at,
            }).eq("id", conn.id);
          } catch (tokenErr) {
            console.error(`[${requestId}] Token refresh failed for ${conn.id}:`, tokenErr);
            results.push({ connection_id: conn.id, spreadsheet_name: conn.spreadsheet_name, status: "error", reason: "token_refresh_failed" });
            continue;
          }
        }

        // Check Drive fingerprint
        const driveFingerprint = await getDriveModifiedTime(accessToken!, conn.spreadsheet_id);
        if (driveFingerprint && conn.last_source_fingerprint === driveFingerprint) {
          console.log(`[${requestId}] Connection ${conn.id}: no changes (fingerprint match)`);
          // Update last_sync_at even for no-op to show "checked"
          await supabase.from("google_sheet_connections").update({
            last_sync_at: new Date().toISOString(), sync_status: "success",
          }).eq("id", conn.id);
          results.push({ connection_id: conn.id, spreadsheet_name: conn.spreadsheet_name, status: "skipped", reason: "no_changes" });
          continue;
        }

        // Call sheets-sync-all-tabs internally
        console.log(`[${requestId}] Connection ${conn.id}: changes detected, triggering sync`);
        const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/sheets-sync-all-tabs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "x-internal-secret": Deno.env.get("CRON_SECRET") ?? "",
          },
          body: JSON.stringify({
            connection_id: conn.id,
            _internal_user_id: conn.user_id,
          }),
        });

        const syncResult = await syncRes.json();
        const status = syncRes.ok ? "success" : "error";
        console.log(`[${requestId}] Connection ${conn.id}: sync ${status}`, JSON.stringify(syncResult).substring(0, 200));
        results.push({ connection_id: conn.id, spreadsheet_name: conn.spreadsheet_name, status, reason: syncResult.error || undefined });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[${requestId}] Connection ${conn.id} error:`, msg);
        // Don't let one connection failure stop others
        results.push({ connection_id: conn.id, spreadsheet_name: conn.spreadsheet_name, status: "error", reason: msg });
      }
    }

    console.log(`[${requestId}] scheduled-sync completed: ${results.length} connections processed`);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] scheduled-sync error:`, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
