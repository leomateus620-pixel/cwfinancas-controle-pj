import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDemandStats, type StatsFilters } from "@/hooks/useDemandStats";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { DEMAND_TYPES } from "@/lib/demands/types";
import { Clock, Inbox, CheckSquare, TrendingUp, AlertCircle } from "lucide-react";
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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtHours(h: number) {
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

  const statusData = useMemo(() => Object.entries(stats?.byStatus ?? {}).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v, fill: STATUS_COLORS[k] ?? "#94a3b8" })), [stats]);
  const typeData = useMemo(() => Object.entries(stats?.byType ?? {}).map(([k, v], i) => ({ name: DEMAND_TYPES.find((t) => t.value === k)?.label ?? k, value: v, fill: TYPE_COLORS[i % TYPE_COLORS.length] })), [stats]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Visão geral das demandas</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe volume, tempo de resposta e gargalos do BPO.</p>
      </div>

      {/* Filtros */}
      <GlassCard className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">De</label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Até</label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
            <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {DEMAND_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridade</label>
            <Select value={filters.priority ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</label>
            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.keys(STATUS_COLORS).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : error ? (
        <GlassCard className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" />
          <p className="text-sm">Falha ao carregar indicadores.</p>
        </GlassCard>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi icon={Inbox} label="No período" value={stats.total.toString()} sub={`${stats.inMonthCount} no mês`} />
            <Kpi icon={CheckSquare} label="Aguardando aprovação" value={stats.pendingApprovals.toString()} sub={<Link to="/demands/approvals" className="text-primary hover:underline">ver fila</Link>} />
            <Kpi icon={Clock} label="Tempo médio de resolução" value={fmtHours(stats.avgHours)} />
            <Kpi icon={TrendingUp} label="Volume finalizado (mês)" value={fmtBRL(stats.totalVolume)} mono />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuição por status</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} layout="vertical" margin={{ left: 30 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold mb-4">Por tipo de demanda</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {typeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold mb-4">Mais antigas em aberto</h3>
            {stats.oldestOpen.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma demanda em aberto. Time no controle.</p>
            ) : (
              <ul className="divide-y divide-black/[0.04]">
                {stats.oldestOpen.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/demands/${d.id}`} className="text-sm font-medium hover:underline line-clamp-1">{d.title}</Link>
                      <div className="text-xs text-muted-foreground">Criada em {new Date(d.created_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={d.priority} />
                      <StatusBadge status={d.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, mono }: { icon: typeof Clock; label: string; value: string; sub?: React.ReactNode; mono?: boolean }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className={`text-2xl font-semibold mt-2 ${mono ? "font-mono tabular-nums" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </GlassCard>
  );
}
