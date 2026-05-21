import { useState } from "react";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, MessageSquareText, FileText, User } from "lucide-react";
import { UploadDropzone } from "./UploadDropzone";
import { useCreateDemand } from "@/hooks/useDemand";
import { useUploadDemandDocument } from "@/hooks/useDemandDocuments";
import { interpretDemand, buildAutoTitle } from "@/lib/demands/interpretFreeText";
import { cn } from "@/lib/utils";

export interface QuickDemandState {
  requester_name: string;
  requester_company: string;
  description: string;
}

const EMPTY: QuickDemandState = {
  requester_name: "",
  requester_company: "",
  description: "",
};

interface Props {
  onCreated: (demandId: string, state: QuickDemandState) => void;
}

export function QuickDemandForm({ onCreated }: Props) {
  const [form, setForm] = useState<QuickDemandState>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof QuickDemandState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const create = useCreateDemand();
  const upload = useUploadDemandDocument();

  const set = (k: keyof QuickDemandState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (form.requester_name.trim().length < 2) e.requester_name = "Informe o nome do solicitante.";
    if (form.requester_company.trim().length < 2) e.requester_company = "Informe a empresa.";
    if (form.description.trim().length < 5) e.description = "Descreva a demanda antes de enviar.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (submitting) return;
    if (!validate()) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setSubmitting(true);
    try {
      const interpretation = interpretDemand(form.description);
      const title = buildAutoTitle(interpretation, form.requester_company);
      const id = await create.mutateAsync({
        demand_type: interpretation.detected_type,
        title,
        priority: interpretation.detected_urgency,
        amount: interpretation.amount_numeric ?? null,
        due_date: interpretation.due_date_iso ?? null,
        description: form.description.trim(),
        requester_metadata: {
          name: form.requester_name.trim(),
          company: form.requester_company.trim(),
          interpretation: JSON.stringify(interpretation),
        },
      });
      if (files.length > 0) {
        await Promise.all(files.map((f) => upload.mutateAsync({ demandId: id, file: f })));
      }
      toast.success("Demanda enviada com sucesso");
      onCreated(id, form);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? "Não foi possível enviar a demanda agora. Tente novamente em alguns instantes."
          : "Falha ao enviar demanda.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Identificação */}
      <GlassCard className="relative overflow-hidden p-5 md:p-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-blue-400/12 blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <User className="w-4 h-4 text-primary" />
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-primary font-semibold">
              Identificação
            </span>
          </div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight">Quem está enviando esta demanda?</h2>
          <p className="text-xs md:text-[13px] text-muted-foreground mt-1 mb-4">
            Confirme seus dados para que a equipe da CW possa acompanhar sua solicitação.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrap label="Nome do solicitante" required error={errors.requester_name}>
              <Input
                value={form.requester_name}
                onChange={(e) => set("requester_name", e.target.value)}
                placeholder="Ex.: Maria Silva"
                className={cn("bg-white/80", errors.requester_name && "border-destructive focus-visible:ring-destructive/40")}
                maxLength={120}
              />
            </FieldWrap>
            <FieldWrap label="Empresa" required error={errors.requester_company}>
              <Input
                value={form.requester_company}
                onChange={(e) => set("requester_company", e.target.value)}
                placeholder="Ex.: Acme Ltda"
                className={cn("bg-white/80", errors.requester_company && "border-destructive focus-visible:ring-destructive/40")}
                maxLength={120}
              />
            </FieldWrap>
          </div>
        </div>
      </GlassCard>

      {/* Descrição (card premium 3D) */}
      <div
        className={cn(
          "relative rounded-3xl p-[1px] transition-transform",
          "bg-gradient-to-br from-blue-400/40 via-white/20 to-emerald-400/30",
          "shadow-[0_24px_60px_-24px_rgba(59,130,246,0.35),0_8px_24px_-12px_rgba(16,185,129,0.25)]",
        )}
      >
        <div className="relative rounded-[calc(1.5rem-1px)] bg-white/70 backdrop-blur-2xl overflow-hidden p-5 md:p-6">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-blue-400/15 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-emerald-400/15 blur-3xl" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[10.5px] uppercase tracking-[0.16em] text-primary font-semibold">
                Demanda
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-foreground/70" /> Descreva sua demanda
            </h2>
            <p className="text-xs md:text-[13px] text-muted-foreground mt-1 mb-4">
              Explique o que você precisa. Pode escrever de forma simples, como se estivesse mandando uma mensagem para a equipe.
            </p>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex.: Preciso solicitar o pagamento de uma nota no valor de R$ 1.000,00 para o fornecedor X, com vencimento em 20/05. Segue documento em anexo."
              className={cn(
                "bg-white/90 backdrop-blur-md border-black/[0.06] rounded-2xl px-4 py-3.5",
                "text-[14px] md:text-[15px] leading-relaxed min-h-[180px] md:min-h-[200px]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_-4px_rgba(15,23,42,0.08)]",
                "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40",
                "transition-shadow",
                errors.description && "border-destructive focus-visible:ring-destructive/40",
              )}
              maxLength={4000}
            />
            <div className="flex items-center justify-between mt-2">
              {errors.description ? (
                <span className="text-[11.5px] text-destructive">{errors.description}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  A equipe da CW interpreta o texto e organiza a demanda automaticamente.
                </span>
              )}
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {form.description.length}/4000
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Anexos */}
      <GlassCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-primary font-semibold">Opcional</span>
        </div>
        <h2 className="text-base md:text-lg font-semibold tracking-tight">Anexar documentos</h2>
        <p className="text-xs md:text-[13px] text-muted-foreground mt-1 mb-4">
          Adicione notas, comprovantes, boletos, planilhas ou qualquer arquivo relacionado à solicitação.
        </p>
        <UploadDropzone files={files} onChange={setFiles} />
      </GlassCard>

      {/* Botão */}
      <div className="flex justify-end pt-1">
        <Button
          onClick={submit}
          disabled={submitting}
          size="lg"
          className="gap-2 px-7 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.6)] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 w-full sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enviando demanda...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" /> Enviar demanda
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldWrap({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[12px] font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error && <div className="text-[11.5px] text-destructive mt-1">{error}</div>}
    </div>
  );
}
