import { useState } from "react";
import { z } from "zod";
import { Loader2, UserCircle2, Building2, ArrowRight, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  company_name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
});

interface Props {
  initialName?: string;
  initialCompany?: string;
  onDone: () => void;
}

export function ClientIdentityGate({ initialName = "", initialCompany = "", onDone }: Props) {
  const [fullName, setFullName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);
  const [saving, setSaving] = useState(false);
  const { updateProfile } = useProfile();

  const canSubmit = fullName.trim().length >= 2 && company.trim().length >= 2;

  const submit = async () => {
    const parsed = schema.safeParse({ full_name: fullName, company_name: company });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        full_name: parsed.data.full_name,
        company_name: parsed.data.company_name,
      });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar identificação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto animate-fade-in">
      <GlassCard variant="highlight" className="p-7 md:p-9 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              Vamos começar
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Identifique-se</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Antes de registrar sua demanda, conte rapidamente quem você é. Pedimos isso só uma vez.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs font-medium text-muted-foreground">
                Nome completo
              </Label>
              <div className="relative">
                <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  maxLength={120}
                  autoFocus
                  className="pl-9 bg-white/80 backdrop-blur-sm border-white/60 h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs font-medium text-muted-foreground">
                Empresa
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ex.: Acme Ltda"
                  maxLength={120}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit && !saving) submit();
                  }}
                  className="pl-9 bg-white/80 backdrop-blur-sm border-white/60 h-10"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="w-full mt-6 gap-2 h-11 shadow-[0_8px_22px_-6px_rgba(59,130,246,0.55)] bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
