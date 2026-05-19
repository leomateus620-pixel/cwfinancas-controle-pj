import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useCreateDemand } from "@/hooks/useDemand";
import { useUploadDemandDocument } from "@/hooks/useDemandDocuments";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMAND_TYPES, PRIORITY_OPTIONS } from "@/lib/demands/types";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024;
const STEPS = ["Tipo", "Detalhes", "Documentos", "Revisão"] as const;

const step1Schema = z.object({
  demand_type: z.string().min(1, "Escolha o tipo"),
  title: z.string().trim().min(3, "Título muito curto").max(160),
  priority: z.string().min(1),
});

const step2Schema = z.object({
  amount: z.string().optional(),
  due_date: z.string().optional(),
  supplier_name: z.string().max(160).optional(),
  supplier_document: z.string().max(40).optional(),
  cost_center: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
});

function parseAmount(v?: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function NewDemandPage() {
  const navigate = useNavigate();
  const create = useCreateDemand();
  const upload = useUploadDemandDocument();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    demand_type: "",
    title: "",
    priority: "normal",
    amount: "",
    due_date: "",
    supplier_name: "",
    supplier_document: "",
    cost_center: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => {
    if (step === 0) {
      const r = step1Schema.safeParse(form);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    if (step === 1) {
      const r = step2Schema.safeParse(form);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_SIZE);
    if (tooBig) {
      toast.error(`"${tooBig.name}" excede 10MB`);
      return;
    }
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const id = await create.mutateAsync({
        demand_type: form.demand_type,
        title: form.title.trim(),
        priority: form.priority,
        amount: parseAmount(form.amount),
        due_date: form.due_date || null,
        supplier_name: form.supplier_name.trim() || null,
        supplier_document: form.supplier_document.trim() || null,
        cost_center: form.cost_center.trim() || null,
        description: form.description.trim() || null,
      });

      if (files.length > 0) {
        await Promise.all(files.map((f) => upload.mutateAsync({ demandId: id, file: f })));
      }

      toast.success("Demanda criada");
      navigate(`/demands/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar demanda");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Nova demanda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie sua solicitação financeira em 4 passos.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
              i < step ? "bg-emerald-500 text-white" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-xs hidden md:inline", i === step ? "font-semibold" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <div className={cn("flex-1 h-[2px]", i < step ? "bg-emerald-500" : "bg-muted")} />}
          </div>
        ))}
      </div>

      <GlassCard className="p-6 space-y-5">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Label className="text-sm mb-2 block">Tipo da demanda</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DEMAND_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update("demand_type", t.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition-all hover:bg-white/50",
                      form.demand_type === t.value
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-black/[0.06] bg-white/30"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="title" className="text-sm">Título <span className="text-destructive">*</span></Label>
              <Input id="title" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex: Pagamento boleto fornecedor X" />
            </div>

            <div>
              <Label className="text-sm">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Valor (R$)</Label>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-sm">Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Fornecedor / Cliente</Label>
              <Input value={form.supplier_name} onChange={(e) => update("supplier_name", e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <Label className="text-sm">CNPJ / CPF</Label>
              <Input value={form.supplier_document} onChange={(e) => update("supplier_document", e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label className="text-sm">Centro de custo</Label>
              <Input value={form.cost_center} onChange={(e) => update("cost_center", e.target.value)} placeholder="Opcional" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Descrição</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Contexto, observações, instruções..." />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block rounded-2xl border-2 border-dashed border-black/[0.08] bg-white/30 p-8 text-center cursor-pointer hover:bg-white/50 transition">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm font-medium">Clique ou arraste arquivos aqui</div>
              <div className="text-xs text-muted-foreground mt-1">PDF, imagens, XML — até 10MB cada, máx 10 arquivos</div>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xml"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white/40 px-3 py-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <Row k="Tipo" v={DEMAND_TYPES.find((t) => t.value === form.demand_type)?.label ?? "—"} />
            <Row k="Título" v={form.title} />
            <Row k="Prioridade" v={form.priority} />
            <Row k="Valor" v={form.amount ? `R$ ${form.amount}` : "—"} />
            <Row k="Vencimento" v={form.due_date || "—"} />
            <Row k="Fornecedor" v={form.supplier_name || "—"} />
            <Row k="Documento" v={form.supplier_document || "—"} />
            <Row k="Centro de custo" v={form.cost_center || "—"} />
            <Row k="Descrição" v={form.description || "—"} />
            <Row k="Documentos" v={`${files.length} arquivo(s)`} />
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-black/[0.05]">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-2">Próximo <ArrowRight className="w-4 h-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Enviar demanda
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/[0.04] pb-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right max-w-[60%] break-words">{v}</span>
    </div>
  );
}
