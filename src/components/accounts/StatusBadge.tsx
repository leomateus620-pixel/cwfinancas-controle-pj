import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pago: "bg-emerald-100 text-emerald-700 border-emerald-200",
  recebido: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pendente: "bg-amber-100 text-amber-700 border-amber-200",
  agendado: "bg-blue-100 text-blue-700 border-blue-200",
  previsto: "bg-blue-100 text-blue-700 border-blue-200",
  confirmar: "bg-violet-100 text-violet-700 border-violet-200",
  emitir: "bg-indigo-100 text-indigo-700 border-indigo-200",
  cancelado: "bg-slate-100 text-slate-500 border-slate-200 line-through",
  desconhecido: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  pago: "Pago",
  recebido: "Recebido",
  pendente: "Pendente",
  agendado: "Agendado",
  previsto: "Previsto",
  confirmar: "Confirmar",
  emitir: "Emitir",
  cancelado: "Cancelado",
  desconhecido: "—",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.desconhecido;
  const label = STATUS_LABELS[status] || status;

  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", colorClass, className)}>
      {label}
    </Badge>
  );
}
