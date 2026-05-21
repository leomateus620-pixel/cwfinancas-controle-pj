import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-supabase-client-platform, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASANA_PAT = Deno.env.get("ASANA_PAT");
const ASANA_PROJECT_GID = Deno.env.get("ASANA_PROJECT_GID");

const DEFAULT_STATUS_SECTION_LABELS: Record<string, string> = {
  recebida: "Novas demandas",
  em_analise: "Em análise",
  aguardando_info: "Aguardando cliente",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Em execução",
  em_execucao: "Em execução",
  pagamento_agendado: "Em execução",
  comprovante_enviado: "Finalização",
  finalizada: "Finalizadas",
  cancelada: "Canceladas",
  reprovada: "Reprovadas",
};

interface Demand {
  id: string; demand_code: string | null; title: string; description: string | null;
  demand_type: string; amount: number | null; due_date: string | null;
  supplier_name: string | null; supplier_document: string | null;
  priority: string; status: string;
  created_by: string; asana_task_id: string | null; asana_task_url: string | null;
  created_at?: string;
  requester_metadata:
    | { name?: string; company?: string; email?: string; phone?: string; role?: string; interpretation?: string | Record<string, unknown> }
    | null;
}

const ASANA_MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

async function uploadAttachments(
  svc: ReturnType<typeof createClient>,
  taskGid: string,
  demandId: string,
  asanaPat: string,
  existingNames?: Set<string>,
) {
  const { data: docs, error } = await svc
    .from("financial_demand_documents")
    .select("id,file_name,file_path,file_size")
    .eq("demand_id", demandId);
  if (error || !docs?.length) return { uploaded: 0, skipped: 0, failed: 0 };
  let uploaded = 0, skipped = 0, failed = 0;
  for (const doc of docs as Array<{ id: string; file_name: string; file_path: string; file_size: number | null }>) {
    try {
      if (existingNames?.has(doc.file_name)) { skipped++; continue; }
      if (doc.file_size && doc.file_size > ASANA_MAX_ATTACHMENT_BYTES) {
        await logSync(svc, {
          demand_id: demandId, action: "attachment", status: "error",
          request_payload: { file_name: doc.file_name, file_size: doc.file_size },
          error_message: "Arquivo excede 100MB (limite do Asana)",
        });
        failed++; continue;
      }
      const { data: blob, error: dlErr } = await svc.storage
        .from("demand-documents").download(doc.file_path);
      if (dlErr || !blob) {
        await logSync(svc, {
          demand_id: demandId, action: "attachment", status: "error",
          request_payload: { file_name: doc.file_name, file_path: doc.file_path },
          error_message: `Falha ao baixar do storage: ${dlErr?.message ?? "blob vazio"}`,
        });
        failed++; continue;
      }
      const form = new FormData();
      form.append("file", blob, doc.file_name);
      const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${asanaPat}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await logSync(svc, {
          demand_id: demandId, action: "attachment", status: "error",
          request_payload: { file_name: doc.file_name },
          response_payload: json,
          error_message: json?.errors?.[0]?.message ?? `Asana ${res.status}`,
        });
        failed++; continue;
      }
      await logSync(svc, {
        demand_id: demandId, action: "attachment", status: "success",
        request_payload: { file_name: doc.file_name },
        response_payload: { gid: json?.data?.gid },
      });
      uploaded++;
    } catch (e) {
      await logSync(svc, {
        demand_id: demandId, action: "attachment", status: "error",
        request_payload: { file_name: doc.file_name },
        error_message: e instanceof Error ? e.message : String(e),
      });
      failed++;
    }
  }
  return { uploaded, skipped, failed };
}

async function logSync(svc: ReturnType<typeof createClient>, p: {
  demand_id: string; action: string; status: string;
  request_payload?: unknown; response_payload?: unknown; error_message?: string | null;
}) {
  await svc.from("asana_sync_logs").insert({
    demand_id: p.demand_id, action: p.action, status: p.status,
    request_payload: p.request_payload ?? {}, response_payload: p.response_payload ?? {},
    error_message: p.error_message ?? null,
  });
}

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function contrapartLabel(demand_type: string): { title: string; hint: string } {
  switch ((demand_type || "").toLowerCase()) {
    case "pagamento": return { title: "FORNECEDOR", hint: "quem será pago" };
    case "recebimento": return { title: "CLIENTE", hint: "quem vai pagar / pagou" };
    case "boleto": return { title: "CLIENTE / SACADO", hint: "quem receberá a cobrança" };
    case "nota_fiscal":
    case "emissao_nf": return { title: "TOMADOR", hint: "para quem a NF será emitida" };
    case "reembolso": return { title: "BENEFICIÁRIO", hint: "quem receberá o reembolso" };
    case "conciliacao": return { title: "CONTRAPARTE", hint: "lançamento conciliado" };
    default: return { title: "CLIENTE / FORNECEDOR", hint: "contraparte da demanda" };
  }
}

const DIVIDER = "────────────────────────────";

function buildNotes(d: Demand): string {
  const r = d.requester_metadata ?? {};
  const requesterName = r.name?.trim() || "—";
  const requesterCompany = r.company?.trim() || "—";
  const requesterRole = r.role?.trim();
  const requesterEmail = r.email?.trim();
  const requesterPhone = r.phone?.trim();
  const cp = contrapartLabel(d.demand_type);
  const cpName = d.supplier_name?.trim() || "—";
  const cpDoc = d.supplier_document?.trim() || "—";

  const lines: string[] = [];
  lines.push("📋 DEMANDA");
  lines.push(`Código: ${d.demand_code ?? d.id.slice(0, 8)}`);
  lines.push(`Tipo: ${d.demand_type}`);
  lines.push(`Valor: ${fmtBRL(d.amount)}`);
  lines.push(`Vencimento: ${fmtDate(d.due_date)}`);
  lines.push(`Prioridade: ${d.priority}`);
  lines.push(`Status: ${d.status}`);
  lines.push(DIVIDER);
  lines.push("👤 QUEM ENVIOU (Solicitante)");
  lines.push(`Nome: ${requesterName}`);
  lines.push(`Empresa: ${requesterCompany}`);
  if (requesterRole) lines.push(`Cargo/Setor: ${requesterRole}`);
  if (requesterEmail) lines.push(`E-mail: ${requesterEmail}`);
  if (requesterPhone) lines.push(`WhatsApp: ${requesterPhone}`);
  lines.push(DIVIDER);
  lines.push(`🏢 ${cp.title} (${cp.hint})`);
  lines.push(`Nome: ${cpName}`);
  lines.push(`CNPJ/CPF: ${cpDoc}`);
  lines.push(DIVIDER);
  lines.push("📝 DESCRIÇÃO");
  lines.push(d.description?.trim() || "(sem descrição)");
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const demand_id: string | undefined = body?.demand_id;
    if (!demand_id) return new Response(JSON.stringify({ ok: false, error: "demand_id obrigatório" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    if (!isCron) {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return new Response(JSON.stringify({ ok: false, error: "Não autenticado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: ures } = await auth.auth.getUser(token);
      if (!ures?.user) return new Response(JSON.stringify({ ok: false, error: "Sessão inválida" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASANA_PAT) {
      return new Response(JSON.stringify({ ok: false, error: "ASANA_PAT não configurado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: d } = await svc.from("financial_demands").select("*").eq("id", demand_id).maybeSingle();
    if (!d) return new Response(JSON.stringify({ ok: false, error: "Demanda não encontrada" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const demand = d as Demand;

    // Sem task ainda → delega para create
    if (!demand.asana_task_id) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/asana-create-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ demand_id }),
      });
      const json = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(json), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await svc.from("asana_integration_settings").select("*").limit(1).maybeSingle();
    if (settings && settings.is_enabled === false) {
      return new Response(JSON.stringify({ ok: true, disabled: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const statusMapping = (settings?.status_mapping ?? {}) as Record<string, string>;

    const titlePrefix = demand.supplier_name ? `[${demand.supplier_name}] ` : "";
    const notes = buildNotes(demand);

    const updatePayload: Record<string, unknown> = {
      data: {
        name: `${titlePrefix}${demand.demand_type} - ${demand.title}`,
        notes,
        ...(demand.due_date ? { due_on: demand.due_date } : { due_on: null }),
      },
    };

    const res = await fetch(`https://app.asana.com/api/1.0/tasks/${demand.asana_task_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${ASANA_PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });
    const json = await res.json();

    if (!res.ok) {
      const errMsg = json?.errors?.[0]?.message ?? `Asana ${res.status}`;
      await svc.from("financial_demands").update({
        asana_sync_status: "error",
        asana_sync_error: errMsg.slice(0, 500),
        asana_last_synced_at: new Date().toISOString(),
      }).eq("id", demand.id);
      await logSync(svc, {
        demand_id: demand.id, action: "update", status: "error",
        request_payload: updatePayload, response_payload: json, error_message: errMsg,
      });
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mover seção se mapeamento existir
    const targetSectionGid = statusMapping[demand.status];
    let sectionMoved: string | null = null;
    if (targetSectionGid) {
      const moveRes = await fetch(`https://app.asana.com/api/1.0/sections/${targetSectionGid}/addTask`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ASANA_PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { task: demand.asana_task_id } }),
      });
      sectionMoved = moveRes.ok ? targetSectionGid : null;
    }

    await svc.from("financial_demands").update({
      asana_sync_status: "synced",
      asana_sync_error: null,
      asana_last_synced_at: new Date().toISOString(),
    }).eq("id", demand.id);
    await logSync(svc, {
      demand_id: demand.id, action: "update", status: "success",
      request_payload: { ...updatePayload, section: sectionMoved, status_label: DEFAULT_STATUS_SECTION_LABELS[demand.status] },
      response_payload: { gid: demand.asana_task_id },
    });

    // Anexos: lista os já existentes na task e sobe apenas os novos
    let attachments = { uploaded: 0, skipped: 0, failed: 0 };
    try {
      const listRes = await fetch(
        `https://app.asana.com/api/1.0/tasks/${demand.asana_task_id}/attachments?opt_fields=name&limit=100`,
        { headers: { Authorization: `Bearer ${ASANA_PAT}` } },
      );
      const listJson = await listRes.json().catch(() => ({}));
      const existingNames = new Set<string>(
        (listJson?.data ?? []).map((a: { name?: string }) => a?.name ?? "").filter(Boolean),
      );
      attachments = await uploadAttachments(svc, demand.asana_task_id, demand.id, ASANA_PAT, existingNames);
    } catch (e) {
      await logSync(svc, {
        demand_id: demand.id, action: "attachment", status: "error",
        error_message: `Falha ao listar anexos existentes: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, task_id: demand.asana_task_id, attachments }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
