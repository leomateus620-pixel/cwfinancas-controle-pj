import { useState } from "react";
import { useFinancialDemands, type DemandPriority, type DemandStatus } from "@/hooks/useFinancialDemands";
import { GlassCard } from "@/components/home/GlassCard";
import { DemandFilters } from "@/components/demands/DemandFilters";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Inbox, Plus, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const TYPE_LABELS: Record<string, string> = {
  pagamento: "Solicitar pagamento",
  nota_fiscal: "Enviar nota fiscal",
  boleto: "Enviar boleto",
  emissao_boleto: "Emissão de boleto",
  emissao_nf: "Emissão de NF",
  comprovante: "Comprovante",
  reembolso: "Reembolso",
  conciliacao: "Conciliação",
  geral: "Financeira geral",
};

export default function DemandsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DemandStatus | "all">("all");
  const [priority, setPriority] = useState<DemandPriority | "all">("all");

  const { data, isLoading, error } = useFinancialDemands({ search, status, priority });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Demandas Recebidas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe todas as solicitações financeiras dos clientes em um só lugar.
          </p>
        </div>
        <Button asChild className="rounded-xl gap-2">
          <Link to="/demands/new"><Plus className="w-4 h-4" />Nova demanda</Link>
        </Button>
      </div>

      <GlassCard className="p-4">
        <DemandFilters
          search={search} status={status} priority={priority}
          onSearch={setSearch} onStatus={setStatus} onPriority={setPriority}
        />
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <p className="text-sm font-medium">Não foi possível carregar as demandas</p>
            <p className="text-xs text-muted-foreground mt-1">{String(error instanceof Error ? error.message : error)}</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" />
            <h3 className="text-base font-semibold">Nenhuma demanda ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Quando uma solicitação for criada, ela aparecerá aqui.
            </p>
            <Button asChild className="rounded-xl gap-2">
              <Link to="/demands/new"><Plus className="w-4 h-4" />Criar primeira demanda</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className="border-b border-black/[0.03] hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="line-clamp-1">{d.title}</div>
                      {d.supplier_name && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{d.supplier_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[d.demand_type] ?? d.demand_type}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">{formatBRL(d.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(d.due_date)}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={d.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
