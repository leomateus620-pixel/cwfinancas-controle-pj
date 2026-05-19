import {
  CreditCard,
  ArrowDownToLine,
  FileText,
  Receipt,
  GitMerge,
  Undo2,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DemandIconKey =
  | "pagamento"
  | "recebimento"
  | "nota_fiscal"
  | "boleto"
  | "conciliacao"
  | "reembolso"
  | "outro"
  | "aprovacao"
  | "urgente"
  | "asana";

interface IconSpec {
  Icon: LucideIcon;
  /** tailwind gradient `from-... to-...` */
  gradient: string;
  /** glow color rgb tuple */
  glow: string;
}

const MAP: Record<DemandIconKey, IconSpec> = {
  pagamento:    { Icon: CreditCard,      gradient: "from-blue-500 to-blue-600",       glow: "59,130,246" },
  recebimento:  { Icon: ArrowDownToLine, gradient: "from-emerald-500 to-emerald-600", glow: "16,185,129" },
  nota_fiscal:  { Icon: FileText,        gradient: "from-violet-500 to-violet-600",   glow: "139,92,246" },
  boleto:       { Icon: Receipt,         gradient: "from-amber-500 to-orange-500",    glow: "245,158,11" },
  conciliacao:  { Icon: GitMerge,        gradient: "from-cyan-500 to-teal-500",       glow: "20,184,166" },
  reembolso:    { Icon: Undo2,           gradient: "from-rose-500 to-pink-500",       glow: "244,63,94"  },
  outro:        { Icon: MoreHorizontal,  gradient: "from-slate-500 to-slate-600",     glow: "100,116,139"},
  aprovacao:    { Icon: CheckCircle2,    gradient: "from-emerald-500 to-green-600",   glow: "16,185,129" },
  urgente:      { Icon: AlertTriangle,   gradient: "from-rose-500 to-orange-500",     glow: "244,63,94"  },
  asana:        { Icon: Link2,           gradient: "from-pink-500 to-fuchsia-600",    glow: "236,72,153" },
};

interface Props {
  kind: DemandIconKey | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DemandTypeIcon({ kind, size = "md", className }: Props) {
  const spec = MAP[(kind as DemandIconKey)] ?? MAP.outro;
  const { Icon, gradient, glow } = spec;

  const dims = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-11 h-11";
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  const radius = size === "sm" ? "rounded-lg" : "rounded-2xl";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center text-white shrink-0",
        "bg-gradient-to-br",
        gradient,
        radius,
        dims,
        "transition-transform duration-200 ease-out",
        className,
      )}
      style={{
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.45),
          inset 0 -2px 4px rgba(0,0,0,0.18),
          0 6px 16px -4px rgba(${glow},0.45),
          0 2px 4px rgba(${glow},0.25)
        `,
      }}
      aria-hidden
    >
      <span
        className="absolute inset-x-1 top-0.5 h-1/3 rounded-t-2xl opacity-60 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }}
      />
      <Icon className={cn("relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]", iconSize)} strokeWidth={2.2} />
    </div>
  );
}

export function getDemandIconSpec(kind: string) {
  return MAP[(kind as DemandIconKey)] ?? MAP.outro;
}
