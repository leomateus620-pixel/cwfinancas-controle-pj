import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ 
          code: "UNAUTHORIZED", 
          message: "Token de autenticação não fornecido",
          connected: false,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ 
          code: "UNAUTHORIZED", 
          message: "Usuário não autenticado",
          connected: false,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check if user has Google OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .select("id, expires_at, scope, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenError) {
      console.error(`[${requestId}] Error fetching OAuth status:`, tokenError);
      return new Response(
        JSON.stringify({ 
          code: "DB_ERROR", 
          message: "Erro ao verificar status da conexão",
          connected: false,
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ 
          code: "NOT_CONNECTED", 
          message: "Conta Google não conectada",
          connected: false,
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    const isExpired = new Date(tokenData.expires_at) < new Date();
    
    return new Response(
      JSON.stringify({
        code: "CONNECTED",
        message: "Conta Google conectada",
        connected: true,
        token_expired: isExpired,
        scope: tokenData.scope,
        connected_at: tokenData.created_at,
        last_updated: tokenData.updated_at,
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        code: "INTERNAL_ERROR", 
        message: "Erro interno do servidor",
        connected: false,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
