import { UserCircle2, Building2, Mail, Phone, Briefcase, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/home/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DemandFormState } from "./SmartDemandForm";

interface Props {
  form: DemandFormState;
  onChange: (k: keyof DemandFormState, v: string) => void;
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function DemandRequesterStep({ form, onChange }: Props) {
  return (
    <GlassCard className="p-5 md:p-7 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            Identificação
          </span>
        </div>
        <h2 className="text-lg md:text-xl font-semibold tracking-tight">Quem está enviando esta demanda?</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xl">
          Antes de registrar sua solicitação, confirme seus dados para que a equipe da CW
          possa acompanhar sua demanda corretamente.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          <FieldWithIcon
            id="requester_name"
            label="Nome do solicitante"
            required
            icon={<UserCircle2 className="w-4 h-4 text-muted-foreground" />}
            value={form.requester_name}
            placeholder="Ex.: Maria Silva"
            autoFocus
            maxLength={120}
            onChange={(v) => onChange("requester_name", v)}
          />
          <FieldWithIcon
            id="requester_company"
            label="Empresa"
            required
            icon={<Building2 className="w-4 h-4 text-muted-foreground" />}
            value={form.requester_company}
            placeholder="Ex.: Acme Ltda"
            maxLength={120}
            onChange={(v) => onChange("requester_company", v)}
          />
          <FieldWithIcon
            id="requester_email"
            label="E-mail"
            type="email"
            icon={<Mail className="w-4 h-4 text-muted-foreground" />}
            value={form.requester_email}
            placeholder="voce@empresa.com"
            maxLength={120}
            onChange={(v) => onChange("requester_email", v)}
          />
          <FieldWithIcon
            id="requester_phone"
            label="WhatsApp"
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            value={form.requester_phone}
            placeholder="(11) 98765-4321"
            maxLength={20}
            onChange={(v) => onChange("requester_phone", maskPhone(v))}
          />
          <div className="sm:col-span-2">
            <FieldWithIcon
              id="requester_role"
              label="Cargo / setor"
              icon={<Briefcase className="w-4 h-4 text-muted-foreground" />}
              value={form.requester_role}
              placeholder="Ex.: Diretor financeiro"
              maxLength={120}
              onChange={(v) => onChange("requester_role", v)}
            />
          </div>
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground">
          Campos com <span className="text-destructive">*</span> são obrigatórios. Os demais ajudam a equipe a contatá-lo mais rápido.
        </p>
      </div>
    </GlassCard>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  autoFocus?: boolean;
  icon: React.ReactNode;
  onChange: (v: string) => void;
}

function FieldWithIcon({ id, label, value, placeholder, required, type, maxLength, autoFocus, icon, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className="pl-9 bg-white/80 backdrop-blur-sm border-white/60 h-10"
        />
      </div>
    </div>
  );
}
