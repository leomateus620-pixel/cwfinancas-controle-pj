import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDemandStats, type StatsFilters } from "@/hooks/useDemandStats";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { MetricTile } from "@/components/demands/ui/MetricTile";
import { DemandTypeIcon } from "@/components/demands/ui/DemandTypeIcon";
import { DEMAND_TYPES } from "@/lib/demands/types";
import { AlertCircle, PlusCircle, ArrowRight, Inbox } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  recebida: "#94a3b8", em_analise: "#3b82f6", aguardando_info: "#f59e0b",
  aguardando_aprovacao: "#8b5cf6", aprovada: "#10b981", reprovada: "#f43f5e",
  em_execucao: "#06b6d4", pagamento_agendado: "#6366f1", comprovante_enviado: "#14b8a6",
  finalizada: "#22c55e", cancelada: "#9ca3af",
};
const TYPE_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#94a3b8"];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtHours(h: number) {
  if (!h || h < 0.01) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} dias`;
}

export default function DemandsDashboardPage() {
  const today = new Date();
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

  const [filters, setFilters] = useState<StatsFilters>({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    type: "all",
    priority: "all",
    status: "all",
  });

  const { data: stats, isLoading, error } = useDemandStats({
    from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59Z` : undefined,
    type: filters.type,
    priority: filters.priority,
    status: filters.status,
  });

  const statusData = useMemo(
    () => Object.entries(stats?.byStatus ?? {}).map(([k, v]) => ({
      name: k.replace(/_/g, " "),
      value: v,
      fill: STATUS_COLORS[k] ?? "#94a3b8",
    })),
    [stats],
  );
  const typeData = useMemo(
    () => Object.entries(stats?.byType ?? {}).map(([k, v], i) => ({
      name: DEMAND_TYPES.find((t) => t.value === k)?.label ?? k,
      value: v,
      fill: TYPE_COLORS[i % TYPE_COLORS.length],
    })),
    [stats],
  );

  const urgenteCount = stats?.byStatus
    ? (stats.byStatus["aguardando_info"] ?? 0) // best-effort visual proxy
    : 0;
  // We don't have a byPriority bucket in the hook; approximate using oldestOpen + total
  // Real "urgentes" computation lives in inbox; keep tile useful with link.

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <GlassCard variant="highlight" className="p-5 md:p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-blue-400/15 blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <DemandTypeIcon kind="aprovacao" size="lg" />
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Central de Demandas Financeiras</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Visão executiva de volume, tempo de resposta e gargalos do BPO.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="bg-white/60 backdrop-blur-md">
              <Link to="/demands"><Inbox className="w-3.5 h-3.5 mr-1.5" />Recebidas</Link>
            </Button>
            <Button asChild size="sm" className="shadow-[0_6px_18px_-6px_rgba(59,130,246,0.55)]">
              <Link to="/demands/new"><PlusCircle className="w-3.5 h-3.5 mr-1.5" />Nova demanda</Link>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Filtros */}
      <GlassCard variant="compact" className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium">De</label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="bg-white/70" />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Até</label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="bg-white/70" />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Tipo</label>
            <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {DEMAND_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Prioridade</label>
            <Select value={filters.priority ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Status</label>
            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.keys(STATUS_COLORS).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : error ? (
        <GlassCard className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" />
          <p className="text-sm">Falha ao carregar indicadores.</p>
        </GlassCard>
      ) : stats ? (
        <>
          {/* KPIs principais — 6 cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricTile
              icon="outro"
              label="Demandas no período"
              value={stats.total.toLocaleString("pt-BR")}
              sub={`${stats.inMonthCount} este mês`}
              to="/demands"
              mono
            />
            <MetricTile
              icon="aprovacao"
              label="Aguardando aprovação"
              value={stats.pendingApprovals.toLocaleString("pt-BR")}
              sub="Ver fila"
              to="/demands/approvals"
              mono
            />
            <MetricTile
              icon="conciliacao"
              label="Tempo médio de resolução"
              value={fmtHours(stats.avgHours)}
              sub="Demandas finalizadas"
            />
            <MetricTile
              icon="recebimento"
              label="Volume financeiro (mês)"
              value={fmtBRL(stats.totalVolume)}
              sub="Demandas finalizadas no mês"
              mono
            />
            <MetricTile
              icon="urgente"
              label="Demandas urgentes em aberto"
              value={stats.oldestOpen.filter((d) => d.priority === "urgente").length.toString()}
              sub="Em fila aberta"
              to="/demands?priority=urgente"
              mono
            />
            <MetricTile
              icon="asana"
              label="Erros de sincronização Asana"
              value={"—"}
              sub={<Link to="/demands?asana_status=error" className="text-primary hover:underline inline-flex items-center gap-1">Inspecionar <ArrowRight className="w-3 h-3" /></Link>}
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Distribuição por status</h3>
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{stats.total} total</span>
              </div>
              {statusData.length === 0 ? (
                <EmptyChart label="Sem dados no período" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ left: 30 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.85)" }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Por tipo de demanda</h3>
              </div>
              {typeData.length === 0 ? (
                <EmptyChart label="Sem dados no período" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                        {typeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.85)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Gargalos */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Demandas em aberto há mais tempo</h3>
              <Link to="/demands" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {stats.oldestOpen.length === 0 ? (
              <div className="text-center py-10">
                <DemandTypeIcon kind="aprovacao" size="lg" className="mx-auto mb-3" />
                <p className="text-sm font-medium">Nenhuma demanda em aberto</p>
                <p className="text-xs text-muted-foreground mt-1">Time no controle das solicitações.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.04]">
                {stats.oldestOpen.map((d) => {
                  const days = Math.floor(
                    (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <DemandTypeIcon kind={d.demand_type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/demands/${d.id}`} className="text-sm font-medium hover:underline line-clamp-1">
                          {d.title}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          Há {days} dia{days === 1 ? "" : "s"} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={d.priority} />
                        <StatusBadge status={d.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
