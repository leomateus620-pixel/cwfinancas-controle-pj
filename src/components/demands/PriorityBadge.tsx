import { Badge } from "@/components/ui/badge";
import type { DemandPriority } from "@/hooks/useFinancialDemands";

const MAP: Record<DemandPriority, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-slate-100 text-slate-600 border-slate-200" },
  normal: { label: "Normal", className: "bg-blue-50 text-blue-700 border-blue-200" },
  alta: { label: "Alta", className: "bg-amber-100 text-amber-700 border-amber-200" },
  urgente: { label: "Urgente", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function PriorityBadge({ priority }: { priority: DemandPriority }) {
  const cfg = MAP[priority] ?? MAP.normal;
  return <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium`}>{cfg.label}</Badge>;
}
