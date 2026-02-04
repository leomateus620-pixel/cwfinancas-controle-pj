import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function refreshAccessToken(
  supabase: any,
  userId: string,
  refreshToken: string,
  requestId: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error(`[${requestId}] Token refresh failed:`, await response.text());
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const updateData: any = {
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    if (data.refresh_token) {
      updateData.refresh_token = data.refresh_token;
    }

    await supabase
      .from("google_oauth_tokens")
      .update(updateData)
      .eq("user_id", userId);

    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (error) {
    console.error(`[${requestId}] Error refreshing token:`, error);
    return null;
  }
}

async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Sheets API error: ${response.status} - ${await response.text()}`);
  }

  return response.json();
}

async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to get values for range ${range}:`, errorText);
    return [];
  }

  const data = await response.json();
  return data.values || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          code: "UNAUTHORIZED",
          message: "Token de autenticação não fornecido",
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({
          code: "UNAUTHORIZED",
          message: "Usuário não autenticado",
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Get spreadsheetId from body
    const body = await req.json();
    const { spreadsheetId, sheetName } = body;

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({
          code: "INVALID_REQUEST",
          message: "spreadsheetId é obrigatório",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch OAuth tokens from database
    const { data: tokenData, error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({
          code: "NOT_CONNECTED",
          message: "Conecte sua conta Google primeiro",
          needs_auth: true,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(tokenData.expires_at);

    // Check if token needs refresh
    if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
      const refreshResult = await refreshAccessToken(supabase, userId, refreshToken, requestId);
      if (!refreshResult) {
        return new Response(
          JSON.stringify({
            code: "REAUTH_REQUIRED",
            message: "Sua sessão do Google expirou. Por favor, reconecte sua conta.",
            needs_auth: true,
            request_id: requestId,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshResult.access_token;
    }

    // Get spreadsheet metadata
    const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
    const spreadsheetName = metadata.properties?.title || "Sem nome";
    const sheets = (metadata.sheets || []).map((sheet: any) => ({
      sheet_id: sheet.properties.sheetId,
      title: sheet.properties.title,
      index: sheet.properties.index,
    }));

    // Get preview values from the first sheet or specified sheet
    const targetSheet = sheetName || sheets[0]?.title || "Sheet1";
    const previewRange = `'${targetSheet}'!A1:Z20`;
    const values = await getSheetValues(accessToken, spreadsheetId, previewRange);

    // Try fallback if no values
    let previewValues = values;
    let usedRange = previewRange;
    
    if (previewValues.length === 0 && !sheetName && sheets.length > 0) {
      // Try without sheet name
      const fallbackRange = "A1:Z20";
      previewValues = await getSheetValues(accessToken, spreadsheetId, fallbackRange);
      usedRange = fallbackRange;
    }

    console.log(`[${requestId}] Successfully fetched preview for ${spreadsheetId}`);

    return new Response(
      JSON.stringify({
        spreadsheet: {
          id: spreadsheetId,
          name: spreadsheetName,
        },
        sheets,
        preview: {
          range: usedRange,
          values: previewValues,
          row_count: previewValues.length,
        },
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[${requestId}] Error reading sheet preview:`, error);

    return new Response(
      JSON.stringify({
        code: "GOOGLE_API_ERROR",
        message: "Falha ao ler dados da planilha",
        details: error.message,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
