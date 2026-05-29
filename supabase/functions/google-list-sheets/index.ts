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

interface TokenData {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shared?: boolean;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
      const errorData = await response.text();
      console.error(`[${requestId}] Token refresh failed:`, errorData);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Update tokens in database
    const updateData: any = {
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    // Only update refresh_token if a new one was provided (token rotation)
    if (data.refresh_token) {
      updateData.refresh_token = data.refresh_token;
    }

    const { error: updateError } = await supabase
      .from("google_oauth_tokens")
      .update(updateData)
      .eq("user_id", userId);

    if (updateError) {
      console.error(`[${requestId}] Failed to update tokens:`, updateError);
    }

    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (error) {
    console.error(`[${requestId}] Error refreshing token:`, error);
    return null;
  }
}

async function listDriveSpreadsheets(
  accessToken: string,
  pageToken?: string,
  searchTerm?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  let q = "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false";
  if (searchTerm) {
    // Sanitize: remove single quotes to prevent query injection
    const sanitized = searchTerm.replace(/'/g, "\\'");
    q += ` and name contains '${sanitized}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime,owners(displayName,emailAddress),shared),nextPageToken",
    orderBy: "modifiedTime desc",
    pageSize: "50",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Drive API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function logToDatabase(
  supabase: any,
  userId: string | null,
  requestId: string,
  route: string,
  level: string,
  message: string,
  details: any = {}
) {
  try {
    await supabase.from("google_integration_logs").insert({
      user_id: userId,
      request_id: requestId,
      route,
      level,
      message,
      details,
    });
  } catch (err) {
    console.error(`[${requestId}] Failed to log to database:`, err);
  }
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

    // Get pageToken and searchTerm from body if provided
    let pageToken: string | undefined;
    let searchTerm: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        pageToken = body.pageToken;
        searchTerm = body.searchTerm;
      } catch {
        // No body or invalid JSON, that's fine
      }
    }

    // Fetch OAuth tokens from database
    const { data: tokenData, error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData) {
      console.log(`[${requestId}] User ${userId} has no Google OAuth tokens`);
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

    // Check if token is expired or about to expire (within 5 minutes)
    const needsRefresh = expiresAt < new Date(Date.now() + 5 * 60 * 1000);

    if (needsRefresh) {
      console.log(`[${requestId}] Token expired or expiring soon, refreshing...`);
      const refreshResult = await refreshAccessToken(supabase, userId, refreshToken, requestId);

      if (!refreshResult) {
        await logToDatabase(supabase, userId, requestId, "google-list-sheets", "error", "Token refresh failed");
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

    // List spreadsheets from Drive API
    try {
      const result = await listDriveSpreadsheets(accessToken, pageToken, searchTerm);

      // Transform the response for frontend
      const spreadsheets = result.files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        provider: file.mimeType === XLSX_MIME ? "drive_xlsx" : "google_sheets",
        modified_time: file.modifiedTime,
        owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || undefined,
        shared: file.shared ?? false,
      }));

      console.log(`[${requestId}] Successfully listed ${spreadsheets.length} spreadsheets`);

      return new Response(
        JSON.stringify({
          spreadsheets,
          nextPageToken: result.nextPageToken,
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (driveError: any) {
      // If Drive API returns 401, try refresh once more
      if (driveError.message?.includes("401")) {
        console.log(`[${requestId}] Got 401 from Drive API, attempting refresh...`);
        const refreshResult = await refreshAccessToken(supabase, userId, refreshToken, requestId);

        if (!refreshResult) {
          await logToDatabase(supabase, userId, requestId, "google-list-sheets", "error", "Token refresh failed after 401");
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

        // Retry with new token
        const result = await listDriveSpreadsheets(refreshResult.access_token, pageToken, searchTerm);
        const spreadsheets = result.files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          provider: file.mimeType === XLSX_MIME ? "drive_xlsx" : "google_sheets",
          modified_time: file.modifiedTime,
          owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || undefined,
          shared: file.shared ?? false,
        }));

        return new Response(
          JSON.stringify({
            spreadsheets,
            nextPageToken: result.nextPageToken,
            request_id: requestId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw driveError;
    }
  } catch (error: any) {
    console.error(`[${requestId}] Error listing spreadsheets:`, error);
    await logToDatabase(supabase, null, requestId, "google-list-sheets", "error", error.message, {
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        code: "GOOGLE_API_ERROR",
        message: "Falha ao listar planilhas do Google",
        details: error.message,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
