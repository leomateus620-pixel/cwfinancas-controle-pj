import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASANA_PAT = Deno.env.get("ASANA_PAT");
const ASANA_PROJECT_GID = Deno.env.get("ASANA_PROJECT_GID");
const ASANA_DEFAULT_SECTION_GID = Deno.env.get("ASANA_DEFAULT_SECTION_GID");

interface Demand {
  id: string;
  demand_code: string | null;
  title: string;
  description: string | null;
  demand_type: string;
  amount: number | null;
  due_date: string | null;
  supplier_name: string | null;
  priority: string;
  status: string;
  created_by: string;
  company_id: string | null;
  asana_task_id: string | null;
  asana_task_url: string | null;
}

const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "URGENTE",
};

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function buildNotes(d: Demand, appOrigin: string): string {
  return [
    `Código: ${d.demand_code ?? d.id.slice(0, 8)}`,
    `Tipo: ${d.demand_type}`,
    `Cliente/Fornecedor: ${d.supplier_name ?? "—"}`,
    `Valor: ${fmtBRL(d.amount)}`,
    `Vencimento: ${fmtDate(d.due_date)}`,
    `Prioridade: ${PRIORITY_LABEL[d.priority] ?? d.priority}`,
    `Status: ${d.status}`,
    "",
    `Descrição:`,
    d.description ?? "(sem descrição)",
    "",
    `Link interno: ${appOrigin}/demands/${d.id}`,
  ].join("\n");
}

async function logSync(svc: ReturnType<typeof createClient>, payload: {
  demand_id: string; action: string; status: string;
  request_payload?: unknown; response_payload?: unknown; error_message?: string | null;
}) {
  await svc.from("asana_sync_logs").insert({
    demand_id: payload.demand_id,
    action: payload.action,
    status: payload.status,
    request_payload: payload.request_payload ?? {},
    response_payload: payload.response_payload ?? {},
    error_message: payload.error_message ?? null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const demand_id: string | undefined = body?.demand_id;
    const dry_run: boolean = body?.dry_run === true;
    if (!demand_id && !dry_run) {
      return new Response(JSON.stringify({ ok: false, error: "demand_id obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth (skip if cron secret matches)
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    let userId: string | null = null;
    if (!isCron) {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: ures } = await authClient.auth.getUser(token);
      userId = ures?.user?.id ?? null;
      if (!userId) return new Response(JSON.stringify({ ok: false, error: "Sessão inválida" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASANA_PAT || !ASANA_PROJECT_GID) {
      const err = "Integração Asana não configurada";
      if (demand_id) {
        await svc.from("financial_demands").update({
          asana_sync_status: "error", asana_sync_error: err, asana_last_synced_at: new Date().toISOString(),
        }).eq("id", demand_id);
        await logSync(svc, { demand_id, action: "create", status: "error", error_message: err });
      }
      return new Response(JSON.stringify({ ok: false, error: err }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry run for "Criar tarefa de teste"
    if (dry_run) {
      const payload: Record<string, unknown> = {
        data: {
          name: "[TESTE] Conexão Lovable → Asana",
          notes: `Tarefa de teste criada em ${new Date().toISOString()} pelo sistema Lovable BPO.`,
          projects: [ASANA_PROJECT_GID],
        },
      };
      const res = await fetch("https://app.asana.com/api/1.0/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ASANA_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) return new Response(JSON.stringify({
        ok: false, error: json?.errors?.[0]?.message ?? `Asana ${res.status}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({
        ok: true, task_id: json.data?.gid, task_url: json.data?.permalink_url, test: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load demand & settings
    const { data: demand } = await svc.from("financial_demands").select("*").eq("id", demand_id).maybeSingle();
    if (!demand) {
      return new Response(JSON.stringify({ ok: false, error: "Demanda não encontrada" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const d = demand as Demand;

    const { data: settings } = await svc.from("asana_integration_settings").select("*").limit(1).maybeSingle();
    if (settings && settings.is_enabled === false) {
      await svc.from("financial_demands").update({
        asana_sync_status: "disabled", asana_sync_error: null,
      }).eq("id", d.id);
      return new Response(JSON.stringify({ ok: true, disabled: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectGid = (settings?.project_gid as string) || ASANA_PROJECT_GID;
    const sectionGid = (settings?.default_section_gid as string) || ASANA_DEFAULT_SECTION_GID || null;
    const assigneeGid = (settings?.default_assignee_gid as string) || null;

    // Permission
    if (!isCron && userId) {
      const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
      const isInternal = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
      if (!isInternal && d.created_by !== userId) {
        return new Response(JSON.stringify({ ok: false, error: "Sem permissão" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Idempotência: já existe task → delega update
    if (d.asana_task_id) {
      // chama internamente a update via fetch (mesmo endpoint pattern)
      const updRes = await fetch(`${SUPABASE_URL}/functions/v1/asana-update-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ demand_id: d.id }),
      });
      const updJson = await updRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        ok: !!updJson?.ok, task_id: d.asana_task_id, task_url: d.asana_task_url,
        idempotent: true, ...updJson,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Marca syncing
    await svc.from("financial_demands").update({ asana_sync_status: "syncing" }).eq("id", d.id);

    const origin = req.headers.get("origin") ?? "https://app.lovable.dev";
    const titlePrefix = d.supplier_name ? `[${d.supplier_name}] ` : "";
    const taskPayload: Record<string, unknown> = {
      data: {
        name: `${titlePrefix}${d.demand_type} - ${d.title}`,
        notes: buildNotes(d, origin),
        projects: [projectGid],
        ...(sectionGid ? { memberships: [{ project: projectGid, section: sectionGid }] } : {}),
        ...(d.due_date ? { due_on: d.due_date } : {}),
        ...(assigneeGid ? { assignee: assigneeGid } : {}),
      },
    };

    const res = await fetch("https://app.asana.com/api/1.0/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ASANA_PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskPayload),
    });
    const json = await res.json();

    if (!res.ok) {
      const errMsg = json?.errors?.[0]?.message ?? `Asana ${res.status}`;
      await svc.from("financial_demands").update({
        asana_sync_status: "error",
        asana_sync_error: errMsg.slice(0, 500),
        asana_last_synced_at: new Date().toISOString(),
      }).eq("id", d.id);
      await logSync(svc, {
        demand_id: d.id, action: "create", status: "error",
        request_payload: taskPayload, response_payload: json, error_message: errMsg,
      });
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskGid = json.data?.gid as string;
    const taskUrl = json.data?.permalink_url as string;
    await svc.from("financial_demands").update({
      asana_task_id: taskGid,
      asana_task_url: taskUrl,
      asana_sync_status: "synced",
      asana_sync_error: null,
      asana_last_synced_at: new Date().toISOString(),
    }).eq("id", d.id);
    await logSync(svc, {
      demand_id: d.id, action: "create", status: "success",
      request_payload: taskPayload, response_payload: { gid: taskGid, url: taskUrl },
    });

    return new Response(JSON.stringify({ ok: true, task_id: taskGid, task_url: taskUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
