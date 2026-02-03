import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
    console.error("Refresh token error:", errorText);
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  return { access_token: data.access_token, expires_in: data.expires_in || 3600 };
}

// Check if token is expired or about to expire (5 min buffer)
function isTokenExpired(expiresAt: string): boolean {
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return now >= expirationTime - bufferMs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
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

    // Parse body (may contain tokens from frontend or spreadsheet_id)
    const body = await req.json().catch(() => ({}));
    const { spreadsheet_id } = body;

    // First, try to get tokens from body (backward compatibility)
    let accessToken = body.access_token;
    let refreshToken = body.refresh_token;

    // If no tokens in body, fetch from database
    if (!accessToken) {
      const { data: tokenData, error: tokenError } = await supabase
        .from("google_oauth_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: "Not authenticated with Google", needs_auth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;

      // Check if token is expired and refresh if needed
      if (isTokenExpired(tokenData.expires_at)) {
        console.log("Token expired, refreshing...");
        try {
          const refreshed = await refreshAccessToken(refreshToken);
          accessToken = refreshed.access_token;

          // Update tokens in database
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          await supabase
            .from("google_oauth_tokens")
            .update({ access_token: accessToken, expires_at: newExpiresAt })
            .eq("user_id", userId);
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          return new Response(
            JSON.stringify({ error: "Google authorization expired. Please re-authenticate.", needs_auth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Helper function to make Google API requests with retry on 401
    async function googleApiRequest(url: string, retried = false): Promise<Response> {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401 && !retried && refreshToken) {
        console.log("Got 401, attempting token refresh...");
        try {
          const refreshed = await refreshAccessToken(refreshToken);
          accessToken = refreshed.access_token;

          // Update tokens in database
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          await supabase
            .from("google_oauth_tokens")
            .update({ access_token: accessToken, expires_at: newExpiresAt })
            .eq("user_id", userId);

          // Retry the request
          return googleApiRequest(url, true);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          throw new Error("Google authorization expired. Please re-authenticate.");
        }
      }

      return response;
    }

    // If spreadsheet_id is provided, get sheets from that spreadsheet
    if (spreadsheet_id) {
      const sheetsResponse = await googleApiRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?fields=sheets.properties,properties.title`
      );

      if (!sheetsResponse.ok) {
        const error = await sheetsResponse.text();
        console.error("Sheets API error:", error);
        throw new Error("Failed to fetch spreadsheet details");
      }

      const spreadsheetData = await sheetsResponse.json();
      
      return new Response(
        JSON.stringify({
          spreadsheet_name: spreadsheetData.properties?.title,
          sheets: spreadsheetData.sheets?.map((s: any) => ({
            sheet_id: s.properties.sheetId,
            title: s.properties.title,
            index: s.properties.index,
          })) || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List all spreadsheets from Google Drive
    const driveResponse = await googleApiRequest(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime,owners)"
    );

    if (!driveResponse.ok) {
      const error = await driveResponse.text();
      console.error("Drive API error:", error);
      throw new Error("Failed to list spreadsheets");
    }

    const driveData = await driveResponse.json();

    return new Response(
      JSON.stringify({
        spreadsheets: driveData.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          modified_time: f.modifiedTime,
          owner: f.owners?.[0]?.displayName,
        })) || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in google-sheets-list:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const needsAuth = errorMessage.includes("re-authenticate") || errorMessage.includes("Not authenticated");
    return new Response(
      JSON.stringify({ error: errorMessage, needs_auth: needsAuth }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
