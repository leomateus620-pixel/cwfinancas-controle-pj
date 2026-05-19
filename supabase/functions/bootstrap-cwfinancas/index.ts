// One-shot bootstrap to create the cwfinancas client user.
// Safe to delete after running.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // No auth gate — function will be deleted right after running.

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const username = "cwfinancas";
  const email = `${username}@cliente.cwfinancas.local`;
  const password = "bpo2026";
  const display_name = "CW Finanças";

  // If already exists, just ensure role + client_users row
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "cliente",
        username,
        display_name,
        full_name: display_name,
      },
    });
    if (error || !created?.user) {
      return new Response(JSON.stringify({ ok: false, step: "create", error: error?.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    user = created.user;
  } else {
    // Force the password to match the requested one
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }

  // Ensure role = cliente
  await admin.from("user_roles").delete().eq("user_id", user.id);
  await admin.from("user_roles").insert({ user_id: user.id, role: "cliente" });

  // Ensure profile row
  await admin.from("profiles").upsert(
    { id: user.id, full_name: display_name, company_name: "CW Finanças" },
    { onConflict: "id" },
  );

  // Ensure client_users row
  await admin.from("client_users").upsert(
    { user_id: user.id, username, display_name, is_active: true },
    { onConflict: "user_id" },
  );

  return new Response(
    JSON.stringify({ ok: true, user_id: user.id, username, email }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
