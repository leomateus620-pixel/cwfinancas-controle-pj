import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, Filter, LayoutGrid, List, RefreshCw,
  AlertCircle, Inbox, Clock, AlertTriangle, CheckCircle2, Users,
  Zap, CalendarClock, ShieldCheck, ShieldAlert, Timer, MoreHorizontal,
  ArrowUpRight, Columns3, Settings2, Cloud,
} from "lucide-react";
import {
  useDemandsInbox, useDemandsInboxStats, useUniqueDemandTypes,
  type AsanaSyncStatus, type InboxFilters, type InboxQuickFilter, type InboxDemand,
} from "@/hooks/useDemandsInbox";
import { useDemandQuickActions } from "@/hooks/useDemandQuickActions";
import { useUserRole } from "@/hooks/useUserRole";
import type { DemandPriority, DemandStatus } from "@/hooks/useFinancialDemands";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/demands/StatusBadge";
import { PriorityBadge } from "@/components/demands/PriorityBadge";
import { AsanaChip } from "@/components/demands/AsanaChip";
import { DemandsKanbanBoard } from "@/components/demands/DemandsKanbanBoard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";


const TYPE_LABELS: Record<string, string> = {
  pagamento: "Solicitar pagamento",
  recebimento: "Registrar recebimento",
  nota_fiscal: "Emitir NF",
  emissao_nf: "Emissão de NF",
  boleto: "Boleto / cobrança",
  emissao_boleto: "Emissão de boleto",
  comprovante: "Comprovante",
  reembolso: "Reembolso",
  conciliacao: "Conciliação",
  geral: "Financeira geral",
  outro: "Outro",
};

const STATUS_OPTIONS: { value: DemandStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "recebida", label: "Recebida" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_info", label: "Aguardando info" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovada", label: "Aprovada" },
  { value: "em_execucao", label: "Em execução" },
  { value: "pagamento_agendado", label: "Pagamento agendado" },
  { value: "comprovante_enviado", label: "Comprovante enviado" },
  { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "reprovada", label: "Reprovada" },
];

const QUICK_STATUS_TRANSITIONS: DemandStatus[] = [
  "em_analise", "aguardando_info", "aguardando_aprovacao", "aprovada",
  "em_execucao", "pagamento_agendado", "comprovante_enviado", "finalizada", "cancelada",
];

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtRelative(iso: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// AsanaChip importado de @/components/demands/AsanaChip



interface KpiTileProps {
  label: string;
  value: number | string;
  icon: typeof Inbox;
  tone: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate" | "cyan" | "indigo";
  active?: boolean;
  onClick?: () => void;
}
function KpiTile({ label, value, icon: Icon, tone, active, onClick }: KpiTileProps) {
  const toneMap: Record<KpiTileProps["tone"], string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 border-blue-500/20",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 border-emerald-500/20",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 border-amber-500/20",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 border-rose-500/20",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 border-violet-500/20",
    slate: "from-slate-400/15 to-slate-400/5 text-slate-600 border-slate-400/20",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 border-cyan-500/20",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600 border-indigo-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-xl p-3 text-left transition-all",
        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        toneMap[tone],
        active && "ring-2 ring-offset-1 ring-current scale-[1.02] shadow-lg",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <Icon className="w-3.5 h-3.5 opacity-80" />
        {active && <ArrowUpRight className="w-3 h-3" />}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-wider opacity-70 line-clamp-1">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5 font-mono">{value}</div>
    </button>
  );
}

type ViewMode = "table" | "cards" | "kanban";

export default function DemandsListPage() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [filters, setFilters] = useState<InboxFilters>({});
  const [view, setView] = useState<ViewMode>(() => {
    const v = localStorage.getItem("demands-view") as ViewMode | null;
    return v === "table" || v === "cards" || v === "kanban" ? v : "table";
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  const { data: rows, total, isLoading, error, refetch, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } = useDemandsInbox(filters);
  const { data: stats } = useDemandsInboxStats();
  const { changeStatus, markUrgent, finalize, retryAsana, retryAllAsana } = useDemandQuickActions();
  const types = useUniqueDemandTypes(rows);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filters.search?.trim()) n++;
    if (filters.status && filters.status !== "all") n++;
    if (filters.priority && filters.priority !== "all") n++;
    if (filters.type && filters.type !== "all") n++;
    if (filters.syncStatus && filters.syncStatus !== "all") n++;
    if (filters.quick) n++;
    return n;
  }, [filters]);

  const setQuick = (q: InboxQuickFilter) =>
    setFilters((f) => ({ ...f, quick: f.quick === q ? undefined : q }));

  const setView_ = (v: ViewMode) => { setView(v); localStorage.setItem("demands-view", v); };

  const subtitle = useMemo(() => {
    if (!stats) return "Carregando…";
    const parts: string[] = [`${stats.open} abertas`];
    if (stats.urgent) parts.push(`${stats.urgent} urgentes`);
    if (stats.overdue) parts.push(`${stats.overdue} vencidas`);
    return parts.join(" · ");
  }, [stats]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* HEADER EXECUTIVO */}
      <GlassCard className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="w-5 h-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Demandas Recebidas</h1>
            </div>
            <p className="text-sm text-muted-foreground">Central operacional de BPO Financeiro · {subtitle}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full",
                  stats?.asanaError ? "bg-rose-500" : stats?.asanaOk ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                Asana: {stats?.asanaError ? `${stats.asanaError} com erro` : stats?.asanaOk ? "operacional" : "sem sincronizações"}
              </span>
              <span>·</span>
              <span>Última sync: {fmtRelative(stats?.lastAsanaSync ?? null)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm"
              onClick={() => retryAllAsana.mutate()}
              disabled={retryAllAsana.isPending}
            >
              <Cloud className={cn("w-4 h-4", retryAllAsana.isPending && "animate-pulse")} />
              Sincronizar Asana
            </Button>
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-2 bg-white/50 backdrop-blur-sm">
                <Link to="/demands/settings/asana"><Settings2 className="w-4 h-4" />Configurações</Link>
              </Button>
            )}
            <Button asChild className="rounded-xl gap-2 shadow-md">
              <Link to="/demands/new"><Plus className="w-4 h-4" />Nova demanda</Link>
            </Button>
          </div>
        </div>
      </GlassCard>


      {/* KPI GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <KpiTile label="Recebidas hoje" value={stats?.today ?? 0} icon={Clock} tone="blue" active={filters.quick === "today"} onClick={() => setQuick("today")} />
        <KpiTile label="Em aberto" value={stats?.open ?? 0} icon={Inbox} tone="indigo" active={filters.quick === "open"} onClick={() => setQuick("open")} />
        <KpiTile label="Urgentes" value={stats?.urgent ?? 0} icon={Zap} tone="rose" active={filters.quick === "urgent"} onClick={() => setQuick("urgent")} />
        <KpiTile label="Aguard. cliente" value={stats?.waitingClient ?? 0} icon={Users} tone="amber" active={filters.quick === "waiting_client"} onClick={() => setQuick("waiting_client")} />
        <KpiTile label="Aguard. aprovação" value={stats?.waitingApproval ?? 0} icon={ShieldCheck} tone="violet" active={filters.quick === "waiting_approval"} onClick={() => setQuick("waiting_approval")} />
        <KpiTile label="Vencidas" value={stats?.overdue ?? 0} icon={AlertTriangle} tone="rose" active={filters.quick === "overdue"} onClick={() => setQuick("overdue")} />
        <KpiTile label="Vencem em 3d" value={stats?.dueSoon ?? 0} icon={CalendarClock} tone="amber" active={filters.quick === "due_soon"} onClick={() => setQuick("due_soon")} />
        <KpiTile label="Sync Asana OK" value={stats?.asanaOk ?? 0} icon={CheckCircle2} tone="emerald" active={filters.quick === "asana_ok"} onClick={() => setQuick("asana_ok")} />
        <KpiTile label="Erro de sync" value={stats?.asanaError ?? 0} icon={ShieldAlert} tone="rose" active={filters.quick === "asana_error"} onClick={() => setQuick("asana_error")} />
        <KpiTile label="Tempo médio" value={stats ? `${Math.round(stats.avgHours)}h` : "—"} icon={Timer} tone="cyan" />
      </div>

      {/* FILTROS + VIEW TOGGLE */}
      <GlassCard className="p-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Buscar por código, título ou fornecedor…"
              className="pl-9 bg-white/60 backdrop-blur-sm border-white/40 rounded-xl h-10"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 bg-white/50"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              <Filter className="w-4 h-4" />
              {showAdvanced ? "Ocultar filtros" : "Mais filtros"}
            </Button>
            <div className="flex rounded-xl border border-white/40 bg-white/50 backdrop-blur-sm p-0.5">
              <Button variant={view === "table" ? "default" : "ghost"} size="sm" className="rounded-lg h-8 px-3" onClick={() => setView_("table")} title="Tabela">
                <List className="w-4 h-4" />
              </Button>
              <Button variant={view === "cards" ? "default" : "ghost"} size="sm" className="rounded-lg h-8 px-3" onClick={() => setView_("cards")} title="Cards">
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" className="rounded-lg h-8 px-3" onClick={() => setView_("kanban")} title="Kanban">
                <Columns3 className="w-4 h-4" />
              </Button>
            </div>

          </div>
        </div>
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-white/30">
            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as DemandStatus | "all" }))}>
              <SelectTrigger className="bg-white/60 border-white/40 rounded-xl h-10"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.priority ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v as DemandPriority | "all" }))}>
              <SelectTrigger className="bg-white/60 border-white/40 rounded-xl h-10"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="bg-white/60 border-white/40 rounded-xl h-10"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {types.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.syncStatus ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, syncStatus: v as AsanaSyncStatus | "all" }))}>
              <SelectTrigger className="bg-white/60 border-white/40 rounded-xl h-10"><SelectValue placeholder="Sync Asana" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (Asana)</SelectItem>
                <SelectItem value="synced">Sincronizado</SelectItem>
                <SelectItem value="pending_sync">Pendente</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="not_synced">Não sincronizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </GlassCard>

      {/* CONTEÚDO */}
      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <p className="text-sm font-medium">Não foi possível carregar as demandas</p>
            <p className="text-xs text-muted-foreground mt-1">{String(error instanceof Error ? error.message : error)}</p>
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" />
            <h3 className="text-base font-semibold">Nenhuma demanda encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Ajuste os filtros ou crie a primeira demanda.</p>
            <Button asChild className="rounded-xl gap-2"><Link to="/demands/new"><Plus className="w-4 h-4" />Nova demanda</Link></Button>
          </div>
        ) : view === "table" ? (
          <DemandsTable rows={rows} onOpen={(id) => navigate(`/demands/${id}`)}
            onStatus={(id, status) => changeStatus.mutate({ id, status })}
            onUrgent={(id) => markUrgent.mutate(id)}
            onFinalize={(id) => finalize.mutate(id)}
            onRetry={(id) => retryAsana.mutate(id)}
          />
        ) : view === "cards" ? (
          <DemandsCards rows={rows} onOpen={(id) => navigate(`/demands/${id}`)} />
        ) : (
          <div className="p-4">
            <DemandsKanbanBoard rows={rows} onStatusChange={(id, status) => changeStatus.mutate({ id, status })} />
          </div>
        )}

      </GlassCard>
    </div>
  );
}

/* ---------------------- Subcomponentes ---------------------- */

interface TableProps {
  rows: InboxDemand[];
  onOpen: (id: string) => void;
  onStatus: (id: string, s: DemandStatus) => void;
  onUrgent: (id: string) => void;
  onFinalize: (id: string) => void;
  onRetry: (id: string) => void;
}

function DemandsTable({ rows, onOpen, onStatus, onUrgent, onFinalize, onRetry }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-3">Código</th>
            <th className="px-3 py-3">Demanda</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3 text-right">Valor</th>
            <th className="px-3 py-3">Vencimento</th>
            <th className="px-3 py-3">Prioridade</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Asana</th>
            <th className="px-3 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const overdue = d.due_date && d.due_date < new Date().toISOString().slice(0, 10) && d.status !== "finalizada" && d.status !== "cancelada";
            return (
              <tr
                key={d.id}
                className="border-b border-black/[0.03] hover:bg-white/40 transition-colors cursor-pointer group"
                onClick={() => onOpen(d.id)}
              >
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{d.demand_code ?? "—"}</td>
                <td className="px-3 py-2.5 max-w-[280px]">
                  <div className="font-medium line-clamp-1">{d.title}</div>
                  {d.supplier_name && <div className="text-[11px] text-muted-foreground line-clamp-1">{d.supplier_name}</div>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{TYPE_LABELS[d.demand_type] ?? d.demand_type}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-mono">{fmtBRL(d.amount)}</td>
                <td className={cn("px-3 py-2.5 text-xs", overdue ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
                  {fmtDate(d.due_date)}
                  {overdue && <Badge variant="outline" className="ml-1.5 text-[9px] bg-rose-50 text-rose-700 border-rose-200">vencida</Badge>}
                </td>
                <td className="px-3 py-2.5"><PriorityBadge priority={d.priority} /></td>
                <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2.5"><AsanaChip status={d.asana_sync_status} url={d.asana_task_url} /></td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => onOpen(d.id)}>Abrir demanda</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Alterar status</DropdownMenuLabel>
                      {QUICK_STATUS_TRANSITIONS.filter((s) => s !== d.status).slice(0, 6).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onStatus(d.id, s)}>
                          → {STATUS_OPTIONS.find((o) => o.value === s)?.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {d.priority !== "urgente" && <DropdownMenuItem onClick={() => onUrgent(d.id)}>Marcar como urgente</DropdownMenuItem>}
                      {d.status !== "finalizada" && <DropdownMenuItem onClick={() => onFinalize(d.id)}>Finalizar demanda</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRetry(d.id)}>Reenviar para Asana</DropdownMenuItem>
                      {d.asana_task_url && (
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(d.asana_task_url!); }}>
                          Copiar link do Asana
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DemandsCards({ rows, onOpen }: { rows: InboxDemand[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
      {rows.map((d) => {
        const overdue = d.due_date && d.due_date < new Date().toISOString().slice(0, 10) && d.status !== "finalizada" && d.status !== "cancelada";
        return (
          <button
            key={d.id}
            onClick={() => onOpen(d.id)}
            className="text-left rounded-2xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 hover:scale-[1.01] hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-muted-foreground">{d.demand_code ?? "—"}</span>
              <AsanaChip status={d.asana_sync_status} url={d.asana_task_url} />
            </div>
            <div className="font-semibold line-clamp-2 mb-1">{d.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1 mb-3">
              {TYPE_LABELS[d.demand_type] ?? d.demand_type}{d.supplier_name ? ` · ${d.supplier_name}` : ""}
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono tabular-nums text-base font-semibold">{fmtBRL(d.amount)}</div>
              <div className={cn("text-xs", overdue ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
                {fmtDate(d.due_date)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <PriorityBadge priority={d.priority} />
              <StatusBadge status={d.status} />
              {overdue && <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-200">vencida</Badge>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
