import { lazy, Suspense, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDemand, useUpdateDemandStatus } from "@/hooks/useDemand";
import { useDemandTimeline } from "@/hooks/useDemandTimeline";
import { useDemandChecklist, useToggleChecklistItem } from "@/hooks/useDemandChecklist";
import { useDemandDocuments, useUploadDemandDocument, useDeleteDemandDocument, getDemandDocumentSignedUrl } from "@/hooks/useDemandDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useDemandQuickActions } from "@/hooks/useDemandQuickActions";
import { DemandComments } from "@/components/demands/detail/DemandComments";
import { ApprovalDecisionCard } from "@/components/demands/detail/ApprovalDecisionCard";
import { CategorySuggestionBadge } from "@/components/demands/detail/CategorySuggestionBadge";
import { DemandAsanaActions } from "@/components/demands/detail/DemandAsanaActions";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { AsanaChip } from "@/components/demands/AsanaChip";
import {
  AlertCircle, ArrowLeft, FileText, Download, Trash2, Upload,
  CheckCircle2, Clock, FilePlus, UserCheck, MessageSquare, X as XIcon, Circle, Loader2,
  AlertTriangle, CheckCheck, FileSearch, ListChecks, Layers, Cloud, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const AsanaLogsTab = lazy(() => import("@/components/demands/detail/AsanaLogsTab").then(m => ({ default: m.AsanaLogsTab })));

const STATUS_OPTIONS = [
  "recebida","em_analise","aguardando_info","aguardando_aprovacao","aprovada","reprovada",
  "em_execucao","pagamento_agendado","comprovante_enviado","finalizada","cancelada",
];

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

const EVENT_ICON: Record<string, typeof Clock> = {
  created: FilePlus,
  status_changed: Clock,
  assigned: UserCheck,
  approved: CheckCircle2,
  rejected: XIcon,
  finalized: CheckCheck,
  document_uploaded: FileText,
  comment_added: MessageSquare,
  asana_synced: Cloud,
  asana_error: AlertTriangle,
};

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isManager } = useUserRole();
  const isInternal = isManager;
  const [tab, setTab] = useState<string>("overview");

  const { data: demand, isLoading, error } = useDemand(id);
  const { data: timeline = [] } = useDemandTimeline(id);
  const { data: checklist = [] } = useDemandChecklist(id);
  const { data: documents = [] } = useDemandDocuments(id);
  const upload = useUploadDemandDocument();
  const removeDoc = useDeleteDemandDocument();
  const toggle = useToggleChecklistItem();
  const updateStatus = useUpdateDemandStatus();
  const { finalize } = useDemandQuickActions();

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-sm font-medium">{error ? "Não foi possível carregar a demanda" : "Demanda não encontrada"}</p>
        {error && <p className="text-xs text-muted-foreground mt-1">{String(error instanceof Error ? error.message : error)}</p>}
        <Button asChild variant="outline" className="mt-4"><Link to="/demands">Voltar</Link></Button>
      </div>
    );
  }

  const downloadDoc = async (path: string) => {
    try {
      const url = await getDemandDocumentSignedUrl(path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link");
    }
  };

  const onUploadFiles = (list: FileList | null) => {
    if (!list || !id) return;
    Array.from(list).forEach((file) => {
      upload.mutate({ demandId: id, file }, {
        onSuccess: () => toast.success(`"${file.name}" enviado`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no upload"),
      });
    });
  };

  const overdue = demand.due_date && demand.due_date < new Date().toISOString().slice(0, 10) && !["finalizada","cancelada"].includes(demand.status);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
        <Link to="/demands"><ArrowLeft className="w-4 h-4" />Demandas</Link>
      </Button>

      {/* HEADER */}
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-[11px] text-muted-foreground">{demand.demand_code ?? "—"}</span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">{demand.demand_type.replace(/_/g, " ")}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{demand.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={demand.status} />
                <PriorityBadge priority={demand.priority} />
                <AsanaChip
                  status={demand.asana_sync_status as never}
                  url={demand.asana_task_url}
                  taskId={demand.asana_task_id}
                  errorMessage={demand.asana_sync_error}
                  lastSyncedAt={demand.asana_last_synced_at}
                  isInternal={isInternal}
                  size="sm"
                />
                {overdue && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    <Timer className="w-3 h-3" />SLA estourado
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isInternal && (
                <Select value={demand.status} onValueChange={(v) => updateStatus.mutate({ id: demand.id, status: v }, {
                  onSuccess: () => toast.success("Status atualizado"),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                })}>
                  <SelectTrigger className="w-[220px] bg-white/60 backdrop-blur-sm rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {isInternal && demand.status !== "finalizada" && (
                <Button size="sm" className="rounded-xl gap-2" onClick={() => finalize.mutate(demand.id)}>
                  <CheckCheck className="w-4 h-4" />Finalizar demanda
                </Button>
              )}
            </div>
          </div>

          {/* Asana actions row */}
          <div className="pt-3 border-t border-black/[0.05]">
            <DemandAsanaActions
              demandId={demand.id}
              taskId={demand.asana_task_id}
              taskUrl={demand.asana_task_url}
              syncStatus={demand.asana_sync_status as never}
              isInternal={isInternal}
              onShowLogs={isInternal ? () => setTab("logs") : undefined}
            />
            {!isInternal && demand.asana_sync_status === "error" && (
              <p className="text-xs text-muted-foreground mt-2">
                A sincronização externa está pendente — nossa equipe já foi notificada.
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      <ApprovalDecisionCard demandId={demand.id} status={demand.status} rejectionReason={demand.rejection_reason ?? null} />

      {/* TABS */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-1 inline-flex w-auto min-w-full md:min-w-0">
            <TabsTrigger value="overview" className="gap-1.5 rounded-xl"><Layers className="w-3.5 h-3.5" />Visão geral</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 rounded-xl"><FileText className="w-3.5 h-3.5" />Documentos ({documents.length})</TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5 rounded-xl"><MessageSquare className="w-3.5 h-3.5" />Comentários</TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5 rounded-xl"><ListChecks className="w-3.5 h-3.5" />Checklist</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 rounded-xl"><Clock className="w-3.5 h-3.5" />Timeline</TabsTrigger>
            {isInternal && (
              <TabsTrigger value="logs" className="gap-1.5 rounded-xl"><FileSearch className="w-3.5 h-3.5" />Logs Asana</TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold mb-3">Dados financeiros</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Valor" value={fmtBRL(demand.amount)} mono />
                <Field label="Vencimento" value={fmtDate(demand.due_date)} />
                <Field label="Fornecedor" value={demand.supplier_name || "—"} />
                <Field label="CNPJ/CPF" value={demand.supplier_document || "—"} />
                <Field label="Centro de custo" value={demand.cost_center || "—"} />
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Categoria</dt>
                  <dd className="mt-0.5">
                    <CategorySuggestionBadge demandId={demand.id} suggested={demand.category_suggested} finalCategory={demand.category_final} />
                  </dd>
                </div>
              </dl>
              {demand.description && (
                <div className="mt-4 pt-4 border-t border-black/[0.05]">
                  <div className="text-xs text-muted-foreground mb-1">Descrição</div>
                  <p className="text-sm whitespace-pre-wrap">{demand.description}</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5 space-y-3 text-sm">
              <h3 className="text-sm font-semibold">Operacional</h3>
              <Field label="Código" value={demand.demand_code ?? "—"} mono />
              <Field label="Tipo" value={demand.demand_type.replace(/_/g, " ")} />
              <Field label="Responsável interno" value={demand.assigned_to ? "Equipe interna" : "—"} />
              <Field label="Criado em" value={fmtDateTime(demand.created_at)} />
              <Field label="Última atualização" value={fmtDateTime(demand.updated_at)} />
              {demand.sla_due_at && <Field label="SLA" value={fmtDateTime(demand.sla_due_at)} />}
            </GlassCard>

            {isInternal && (
              <GlassCard className="p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-primary" />Integração Asana
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Field label="Status" value={demand.asana_sync_status} />
                  <Field label="Task ID" value={demand.asana_task_id ?? "—"} mono />
                  <Field label="Última sync" value={fmtDateTime(demand.asana_last_synced_at)} />
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Link</dt>
                    <dd className="mt-0.5">
                      {demand.asana_task_url
                        ? <a className="text-primary hover:underline text-sm" href={demand.asana_task_url} target="_blank" rel="noreferrer">Abrir no Asana</a>
                        : "—"}
                    </dd>
                  </div>
                </div>
                {demand.asana_sync_error && (
                  <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 break-words">
                    {demand.asana_sync_error}
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Documentos ({documents.length})</h3>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-primary hover:underline">
                {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Enviar arquivo
                <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.xml"
                  onChange={(e) => onUploadFiles(e.target.files)} />
              </label>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhum documento anexado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-black/[0.05] bg-white/40 px-3 py-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : ""} · {fmtDate(d.created_at)}
                        {d.extraction_status && d.extraction_status !== "pending" && (
                          <> · extração: {d.extraction_status}</>
                        )}
                      </div>
                    </div>
                    <button onClick={() => downloadDoc(d.file_path)} className="text-muted-foreground hover:text-primary" title="Baixar">
                      <Download className="w-4 h-4" />
                    </button>
                    {isInternal && (
                      <button onClick={() => removeDoc.mutate({ id: d.id, path: d.file_path, demandId: demand.id })} className="text-muted-foreground hover:text-destructive" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </TabsContent>

        {/* COMMENTS */}
        <TabsContent value="comments" className="mt-4">
          <GlassCard className="p-5">
            <DemandComments demandId={demand.id} />
          </GlassCard>
        </TabsContent>

        {/* CHECKLIST */}
        <TabsContent value="checklist" className="mt-4">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold mb-3">Checklist operacional</h3>
            {checklist.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem itens.</p>
            ) : (
              <ul className="space-y-2">
                {checklist.map((it) => (
                  <li key={it.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/40">
                    <Checkbox
                      checked={it.is_completed}
                      disabled={!isInternal}
                      onCheckedChange={(v) => toggle.mutate({ id: it.id, demandId: demand.id, next: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${it.is_completed ? "line-through text-muted-foreground" : ""}`}>{it.label}</div>
                      {it.is_completed && it.completed_at && (
                        <div className="text-[11px] text-muted-foreground">
                          concluído {formatDistanceToNow(new Date(it.completed_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!isInternal && (
              <p className="text-[11px] text-muted-foreground mt-3">
                Apenas a equipe interna pode marcar itens.
              </p>
            )}
          </GlassCard>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold mb-4">Linha do tempo</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem eventos ainda.</p>
            ) : (
              <ol className="relative border-l border-black/[0.08] ml-3 space-y-5">
                {timeline.map((ev) => {
                  const Icon = EVENT_ICON[ev.event_type] ?? Circle;
                  return (
                    <li key={ev.id} className="ml-6">
                      <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-white border border-black/[0.08]">
                        <Icon className="w-3 h-3 text-primary" />
                      </span>
                      <div className="text-sm font-medium">{ev.title}</div>
                      {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </GlassCard>
        </TabsContent>

        {/* LOGS — internal only */}
        {isInternal && (
          <TabsContent value="logs" className="mt-4">
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-primary" />Logs de sincronização Asana
              </h3>
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <AsanaLogsTab demandId={demand.id} />
              </Suspense>
            </GlassCard>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-words ${mono ? "font-mono tabular-nums text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
