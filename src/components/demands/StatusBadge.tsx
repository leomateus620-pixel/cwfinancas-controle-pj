import { Badge } from "@/components/ui/badge";
import type { DemandStatus } from "@/hooks/useFinancialDemands";

const MAP: Record<DemandStatus, { label: string; className: string }> = {
  recebida: { label: "Recebida", className: "bg-slate-100 text-slate-700 border-slate-200" },
  em_analise: { label: "Em análise", className: "bg-blue-100 text-blue-700 border-blue-200" },
  aguardando_info: { label: "Aguardando info", className: "bg-amber-100 text-amber-700 border-amber-200" },
  aguardando_aprovacao: { label: "Aguardando aprovação", className: "bg-violet-100 text-violet-700 border-violet-200" },
  aprovada: { label: "Aprovada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  reprovada: { label: "Reprovada", className: "bg-rose-100 text-rose-700 border-rose-200" },
  em_execucao: { label: "Em execução", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  pagamento_agendado: { label: "Pagamento agendado", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  comprovante_enviado: { label: "Comprovante enviado", className: "bg-teal-100 text-teal-700 border-teal-200" },
  finalizada: { label: "Finalizada", className: "bg-green-100 text-green-700 border-green-200" },
  cancelada: { label: "Cancelada", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export function StatusBadge({ status }: { status: DemandStatus }) {
  const cfg = MAP[status] ?? MAP.recebida;
  return <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium`}>{cfg.label}</Badge>;
}
