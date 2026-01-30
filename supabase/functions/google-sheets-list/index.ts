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
async function refreshAccessToken(refreshToken: string): Promise<string> {
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
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  return data.access_token;
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

    const body = await req.json();
    const { access_token, refresh_token, spreadsheet_id } = body;

    let validAccessToken = access_token;

    // If no access token, try to refresh
    if (!validAccessToken && refresh_token) {
      validAccessToken = await refreshAccessToken(refresh_token);
    }

    if (!validAccessToken) {
      throw new Error("No valid access token available");
    }

    // If spreadsheet_id is provided, get sheets from that spreadsheet
    if (spreadsheet_id) {
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?fields=sheets.properties,properties.title`,
        {
          headers: { Authorization: `Bearer ${validAccessToken}` },
        }
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
    const driveResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime,owners)",
      {
        headers: { Authorization: `Bearer ${validAccessToken}` },
      }
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
