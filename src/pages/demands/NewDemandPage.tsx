import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useCreateDemand } from "@/hooks/useDemand";
import { useDemand } from "@/hooks/useDemand";
import { useUploadDemandDocument } from "@/hooks/useDemandDocuments";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { DEMAND_TYPES, PRIORITY_OPTIONS } from "@/lib/demands/types";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, ClipboardCheck, Sparkles, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThreeDIconCard } from "@/components/demands/ui/ThreeDIconCard";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { StepIndicator } from "@/components/demands/new/StepIndicator";
import { UploadDropzone } from "@/components/demands/new/UploadDropzone";
import { SmartDemandForm, EMPTY_FORM, buildDemandPayload, type DemandFormState } from "@/components/demands/new/SmartDemandForm";
import { AsanaChip } from "@/components/demands/AsanaChip";

const STEPS = ["Tipo", "Informações", "Documentos", "Revisão"] as const;

const TYPE_DESCRIPTIONS: Record<string, string> = {
  pagamento: "Pagar boleto, fornecedor, imposto ou pix avulso.",
  recebimento: "Registrar entrada de dinheiro identificada.",
  nota_fiscal: "Solicitar emissão de NF de serviço ou produto.",
  boleto: "Gerar boleto ou cobrança para um cliente.",
  conciliacao: "Investigar divergência em extrato bancário.",
  reembolso: "Solicitar reembolso de despesa pessoal.",
  outro: "Qualquer outra solicitação financeira.",
};

const step1Schema = z.object({
  demand_type: z.string().min(1, "Escolha o tipo da demanda"),
  title: z.string().trim().min(3, "Título muito curto").max(160),
  priority: z.string().min(1),
});

export default function NewDemandPage() {
  const navigate = useNavigate();
  const create = useCreateDemand();
  const upload = useUploadDemandDocument();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DemandFormState>(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const update = (k: keyof DemandFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectType = (val: string) => {
    setForm((f) => ({ ...f, demand_type: val }));
  };

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const main = document.querySelector("main");
      if (main) main.scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const next = () => {
    if (step === 0) {
      if (!form.demand_type) {
        toast.error("Escolha o tipo da demanda");
        return;
      }
    }
    if (step === 1) {
      const r = step1Schema.safeParse(form);
      if (!r.success) {
        toast.error(r.error.issues[0].message);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scrollToTop();
  };

  const back = () => {
    setStep((s) => Math.max(0, s - 1));
    scrollToTop();
  };



  const submit = async () => {
    setSubmitting(true);
    try {
      const id = await create.mutateAsync(buildDemandPayload(form));
      if (files.length > 0) {
        await Promise.all(files.map((f) => upload.mutateAsync({ demandId: id, file: f })));
      }
      toast.success("Demanda criada");
      setCreatedId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar demanda");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return <SuccessScreen id={createdId} typeKey={form.demand_type} title={form.title} onNew={() => { setCreatedId(null); setForm(EMPTY_FORM); setFiles([]); setStep(0); }} />;
  }

  const typeLabel = DEMAND_TYPES.find((t) => t.value === form.demand_type)?.label ?? "—";

  return (
    <div ref={topRef} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 md:space-y-6 animate-fade-in pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DemandTypeIcon kind={(form.demand_type as DemandIconKey) || "outro"} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Criar demanda inteligente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Preencha em 4 etapas — o formulário adapta-se ao tipo escolhido.</p>
        </div>
      </div>

      {/* Stepper */}
      <GlassCard variant="compact" className="p-4">
        <StepIndicator steps={STEPS} current={step} onStepClick={(i) => { if (i < step) { setStep(i); scrollToTop(); } }} />
      </GlassCard>

      {/* Layout desktop: 2 colunas (form + resumo) somente em xl; mobile/tablet: 1 coluna */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-5 min-w-0">
          {step === 0 && (
            <GlassCard className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Que tipo de demanda você está enviando?</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

                {DEMAND_TYPES.map((t) => (
                  <ThreeDIconCard
                    key={t.value}
                    icon={t.value as DemandIconKey}
                    title={t.label}
                    description={TYPE_DESCRIPTIONS[t.value]}
                    selected={form.demand_type === t.value}
                    onClick={() => selectType(t.value)}
                  />
                ))}
              </div>
            </GlassCard>
          )}

          {step === 1 && <SmartDemandForm form={form} onChange={update} />}

          {step === 2 && (
            <GlassCard className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Anexe documentos de apoio</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Comprovantes, notas, contratos ou prints — opcional, mas acelera a operação.
              </p>
              <UploadDropzone files={files} onChange={setFiles} />
            </GlassCard>
          )}

          {step === 3 && (
            <GlassCard className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Revise antes de enviar</h2>
              </div>
              <ReviewBlock form={form} files={files} typeLabel={typeLabel} />
              <div className="mt-4 rounded-xl bg-primary/[0.06] border border-primary/20 px-3 py-2.5 text-[12px] text-foreground/80 leading-snug">
                Ao enviar, esta demanda será registrada no sistema e encaminhada à equipe responsável.
                Uma tarefa também será criada automaticamente no Asana, se a integração estiver ativa.
              </div>
            </GlassCard>
          )}
        </div>

        {/* Sidebar resumo */}
        <SummarySidebar form={form} files={files} typeLabel={typeLabel} step={step} />
      </div>

      {/* Footer actions — sticky no mobile */}
      <div className="fixed md:static inset-x-0 bottom-0 md:bottom-auto p-3 md:p-0 bg-white/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-0 border-t md:border-0 border-black/[0.06] z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            className="gap-2 bg-white/70"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            {step === STEPS.length - 1 && (
              <Button variant="ghost" disabled={submitting} onClick={() => toast.info("Rascunhos serão implementados em breve.")} className="hidden sm:inline-flex">
                Salvar rascunho
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="gap-2 shadow-[0_6px_18px_-6px_rgba(59,130,246,0.55)]">
                Próximo <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="gap-2 shadow-[0_8px_22px_-6px_rgba(16,185,129,0.55)] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Enviar demanda
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummarySidebar({ form, files, typeLabel, step }: { form: DemandFormState; files: File[]; typeLabel: string; step: number }) {
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === form.priority)?.label ?? form.priority;
  const filled = useMemo(() => {
    const keys: (keyof DemandFormState)[] = ["demand_type", "title", "amount", "due_date", "supplier_name", "description"];
    return Math.round((keys.filter((k) => !!form[k]).length / keys.length) * 100);
  }, [form]);

  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <GlassCard className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Resumo</div>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{filled}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${filled}%` }}
          />
        </div>
        <div className="space-y-2.5 text-[12.5px]">
          <SummaryRow k="Tipo" v={typeLabel} />
          <SummaryRow k="Título" v={form.title || "—"} />
          <SummaryRow k="Prioridade" v={priorityLabel} />
          {form.amount && <SummaryRow k="Valor" v={`R$ ${form.amount}`} mono />}
          {form.due_date && <SummaryRow k="Data" v={new Date(form.due_date).toLocaleDateString("pt-BR")} />}
          {form.supplier_name && <SummaryRow k="Pessoa" v={form.supplier_name} />}
          <SummaryRow k="Documentos" v={`${files.length} arquivo(s)`} />
        </div>
        <div className="mt-4 pt-3 border-t border-black/[0.05] text-[11px] text-muted-foreground">
          Etapa <span className="font-semibold text-foreground">{step + 1}</span> de {STEPS.length}
        </div>
      </GlassCard>
    </div>
  );
}

function SummaryRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className={cn("font-medium text-right break-words min-w-0", mono && "font-mono tabular-nums")}>{v}</span>
    </div>
  );
}

function ReviewBlock({ form, files, typeLabel }: { form: DemandFormState; files: File[]; typeLabel: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
      <ReviewItem label="Tipo" value={typeLabel} />
      <ReviewItem label="Título" value={form.title || "—"} />
      <ReviewItem label="Prioridade" value={PRIORITY_OPTIONS.find((p) => p.value === form.priority)?.label ?? "—"} />
      {form.amount && <ReviewItem label="Valor" value={`R$ ${form.amount}`} mono />}
      {form.due_date && <ReviewItem label="Data" value={new Date(form.due_date).toLocaleDateString("pt-BR")} />}
      {form.supplier_name && <ReviewItem label="Pessoa / empresa" value={form.supplier_name} />}
      {form.supplier_document && <ReviewItem label="CNPJ / CPF" value={form.supplier_document} mono />}
      {form.category && <ReviewItem label="Categoria" value={form.category} />}
      {form.cost_center && <ReviewItem label="Centro de custo" value={form.cost_center} />}
      {form.payment_method && <ReviewItem label="Forma de pagamento" value={form.payment_method} />}
      {form.bank_account && <ReviewItem label="Conta" value={form.bank_account} />}
      {form.description && (
        <div className="md:col-span-2">
          <ReviewItem label="Observações" value={form.description} />
        </div>
      )}
      <div className="md:col-span-2">
        <ReviewItem label="Documentos anexos" value={`${files.length} arquivo(s)`} />
      </div>
    </div>
  );
}

function ReviewItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-white/55 border border-black/[0.05] backdrop-blur-md px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</div>
      <div className={cn("text-sm font-medium mt-0.5 break-words", mono && "font-mono tabular-nums")}>{value}</div>
    </div>
  );
}

function SuccessScreen({ id, typeKey, title, onNew }: { id: string; typeKey: string; title: string; onNew: () => void }) {
  const { data: demand } = useDemand(id);
  const code = demand?.demand_code ?? id.slice(0, 8).toUpperCase();

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
      <GlassCard variant="highlight" className="p-8 md:p-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-blue-400/20 blur-3xl" />
        </div>
        <div className="relative">
          <div className="mx-auto mb-4 inline-flex">
            <DemandTypeIcon kind="aprovacao" size="lg" />
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Demanda enviada com sucesso</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
            Sua solicitação foi registrada e está na fila da equipe responsável.
          </p>

          <div className="mt-6 inline-flex flex-col items-center gap-3 px-5 py-4 rounded-2xl bg-white/70 border border-black/[0.06] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
              <div className="text-left">
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Código</div>
                <div className="text-base font-semibold font-mono tabular-nums">{code}</div>
              </div>
            </div>
            <div className="text-sm font-medium max-w-xs line-clamp-2">{title}</div>
            <AsanaChip
              status={(demand?.asana_sync_status ?? "pending_sync") as never}
              url={demand?.asana_task_url ?? null}
            />
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild variant="outline" className="bg-white/70">
              <Link to={`/demands/${id}`}>
                Ver demanda <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
            <Button onClick={onNew} className="shadow-[0_6px_18px_-6px_rgba(59,130,246,0.55)]">
              Criar nova demanda
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
