import { Link } from "react-router-dom";
import { useFinancialDemands } from "@/hooks/useFinancialDemands";
import { useUserRole } from "@/hooks/useUserRole";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { CheckSquare, AlertCircle, ShieldAlert } from "lucide-react";

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function DemandsApprovalsPage() {
  const { isManager, isLoading: roleLoading } = useUserRole();
  const { data, isLoading, error } = useFinancialDemands({ status: "aguardando_aprovacao" });

  if (!roleLoading && !isManager) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-xs text-muted-foreground mt-1">Esta área é exclusiva da equipe interna.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Aprovações pendentes</h1>
        <p className="text-sm text-muted-foreground mt-1">Demandas aguardando decisão de gestor.</p>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <div className="p-12 text-center"><AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" /><p className="text-sm">Falha ao carregar.</p></div>
        ) : !data || data.length === 0 ? (
          <div className="p-16 text-center">
            <CheckSquare className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
            <h3 className="text-base font-semibold">Nada pendente</h3>
            <p className="text-sm text-muted-foreground mt-1">Sua fila de aprovações está vazia.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/40 border-b border-black/[0.04]">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Demanda</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criada</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-black/[0.03] hover:bg-white/40">
                  <td className="px-4 py-3">
                    <Link to={`/demands/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                    {d.supplier_name && <div className="text-xs text-muted-foreground">{d.supplier_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtBRL(d.amount)}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={d.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}
