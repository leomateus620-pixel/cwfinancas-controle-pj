import { useParams, Link } from "react-router-dom";
import { useDemand, useUpdateDemandStatus } from "@/hooks/useDemand";
import { useDemandTimeline } from "@/hooks/useDemandTimeline";
import { useDemandChecklist, useToggleChecklistItem } from "@/hooks/useDemandChecklist";
import { useDemandDocuments, useUploadDemandDocument, useDeleteDemandDocument, getDemandDocumentSignedUrl } from "@/hooks/useDemandDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import {
  AlertCircle, ArrowLeft, FileText, Download, Trash2, Upload,
  CheckCircle2, Clock, FilePlus, UserCheck, MessageSquare, X as XIcon, Circle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const EVENT_ICON: Record<string, typeof Clock> = {
  created: FilePlus,
  status_changed: Clock,
  assigned: UserCheck,
  approved: CheckCircle2,
  rejected: XIcon,
  finalized: CheckCircle2,
  document_uploaded: FileText,
  comment_added: MessageSquare,
};

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isManager } = useUserRole();
  const isInternal = isManager;

  const { data: demand, isLoading, error } = useDemand(id);
  const { data: timeline = [] } = useDemandTimeline(id);
  const { data: checklist = [] } = useDemandChecklist(id);
  const { data: documents = [] } = useDemandDocuments(id);
  const upload = useUploadDemandDocument();
  const removeDoc = useDeleteDemandDocument();
  const toggle = useToggleChecklistItem();
  const updateStatus = useUpdateDemandStatus();

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-sm font-medium">Não foi possível carregar a demanda</p>
        <p className="text-xs text-muted-foreground mt-1">{String(error instanceof Error ? error.message : error)}</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/demands">Voltar</Link></Button>
      </div>
    );
  }

  if (!demand) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Demanda não encontrada</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/demands">Voltar para a lista</Link></Button>
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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2 mb-2">
          <Link to="/demands"><ArrowLeft className="w-4 h-4" />Demandas</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{demand.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={demand.status} />
              <PriorityBadge priority={demand.priority} />
              <span className="text-xs text-muted-foreground">Criada em {fmtDate(demand.created_at)}</span>
            </div>
          </div>
          {isInternal && (
            <Select value={demand.status} onValueChange={(v) => updateStatus.mutate({ id: demand.id, status: v }, {
              onSuccess: () => toast.success("Status atualizado"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
            })}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_"," ")}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-8 space-y-6">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold mb-3">Detalhes</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Valor" value={fmtBRL(demand.amount)} mono />
              <Field label="Vencimento" value={fmtDate(demand.due_date)} />
              <Field label="Fornecedor" value={demand.supplier_name || "—"} />
              <Field label="CNPJ/CPF" value={demand.supplier_document || "—"} />
              <Field label="Centro de custo" value={demand.cost_center || "—"} />
              <Field label="Categoria" value={demand.category_final || demand.category_suggested || "—"} />
            </dl>
            {demand.description && (
              <div className="mt-4 pt-4 border-t border-black/[0.05]">
                <div className="text-xs text-muted-foreground mb-1">Descrição</div>
                <p className="text-sm whitespace-pre-wrap">{demand.description}</p>
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Documentos ({documents.length})</h3>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-primary hover:underline">
                {upload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Enviar arquivo
                <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.xml" onChange={(e) => onUploadFiles(e.target.files)} />
              </label>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum documento anexado.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-black/[0.05] bg-white/40 px-3 py-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground">{d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : ""} · {fmtDate(d.created_at)}</div>
                    </div>
                    <button onClick={() => downloadDoc(d.file_path)} className="text-muted-foreground hover:text-primary" title="Baixar">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeDoc.mutate({ id: d.id, path: d.file_path, demandId: demand.id })} className="text-muted-foreground hover:text-destructive" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

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
        </div>

        {/* Coluna lateral */}
        <div className="lg:col-span-4 space-y-6">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold mb-3">Checklist</h3>
            {checklist.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem itens.</p>
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
                          {formatDistanceToNow(new Date(it.completed_at), { addSuffix: true, locale: ptBR })}
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

          <GlassCard className="p-5 text-sm space-y-2">
            <h3 className="text-sm font-semibold mb-2">Resumo</h3>
            <Field label="Criada em" value={new Date(demand.created_at).toLocaleString("pt-BR")} />
            <Field label="Atualizada" value={new Date(demand.updated_at).toLocaleString("pt-BR")} />
            <Field label="Atribuída a" value={demand.assigned_to ? "Equipe interna" : "—"} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
