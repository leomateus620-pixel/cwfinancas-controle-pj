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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Get auth URL for OAuth flow
    if (action === "auth-url") {
      const redirectUri = url.searchParams.get("redirect_uri");
      if (!redirectUri) {
        throw new Error("redirect_uri is required");
      }

      // Check if user already has a refresh token (to decide on prompt)
      let hasRefreshToken = false;
      const authHeader = req.headers.get("Authorization");
      
      if (authHeader?.startsWith("Bearer ")) {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabase.auth.getUser(token);
        
        if (userData?.user) {
          const { data: tokenData } = await supabase
            .from("google_oauth_tokens")
            .select("refresh_token")
            .eq("user_id", userData.user.id)
            .maybeSingle();
          
          hasRefreshToken = !!tokenData?.refresh_token;
        }
      }

      const scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ];

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("include_granted_scopes", "true");
      
      // Only use prompt=consent if user doesn't have a refresh token
      // This ensures we get a refresh token on first auth
      if (!hasRefreshToken) {
        authUrl.searchParams.set("prompt", "consent");
      }

      return new Response(
        JSON.stringify({ auth_url: authUrl.toString(), request_id: requestId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle OAuth callback - exchange code for tokens
    if (req.method === "POST") {
      const body = await req.json();
      const { code, redirect_uri } = body;

      if (!code || !redirect_uri) {
        throw new Error("code and redirect_uri are required");
      }

      // Get authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", request_id: requestId }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user with Supabase
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", request_id: requestId }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = claimsData.user.id;

      // Check if user already has a refresh token (before exchange)
      const { data: existingTokenData } = await supabase
        .from("google_oauth_tokens")
        .select("refresh_token")
        .eq("user_id", userId)
        .maybeSingle();

      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error(`[${requestId}] Token exchange error:`, error);
        throw new Error("Failed to exchange authorization code");
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token, expires_in, scope, token_type } = tokens;

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      // CRITICAL: Don't overwrite refresh_token with null
      // If no new refresh_token came from Google, keep the existing one
      const finalRefreshToken = refresh_token || existingTokenData?.refresh_token;

      if (!finalRefreshToken) {
        console.error(`[${requestId}] No refresh token available for user ${userId}`);
        throw new Error("Nenhum refresh token disponível. Revogue o acesso do app no Google e tente novamente.");
      }

      // Persist tokens in database (upsert)
      const { error: upsertError } = await supabase
        .from("google_oauth_tokens")
        .upsert(
          {
            user_id: userId,
            access_token,
            refresh_token: finalRefreshToken,
            expires_at: expiresAt,
            scope: scope || null,
            token_type: token_type || "Bearer",
            provider: "google",
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error(`[${requestId}] Failed to persist tokens:`, upsertError);
        throw new Error("Failed to save Google credentials");
      }

      console.log(`[${requestId}] Successfully authenticated user ${userId} with Google`);

      // SECURITY: Do NOT return tokens to frontend
      return new Response(
        JSON.stringify({
          success: true,
          message: "Conta Google conectada com sucesso",
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request", request_id: requestId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(`[${requestId}] Error in google-sheets-auth:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
