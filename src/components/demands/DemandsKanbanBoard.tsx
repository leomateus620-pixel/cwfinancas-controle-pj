import { useMemo } from "react";
import {
  DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { GripVertical, Calendar, Building2, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { AsanaChip } from "./AsanaChip";
import type { InboxDemand } from "@/hooks/useDemandsInbox";
import type { DemandStatus } from "@/hooks/useFinancialDemands";

interface ColumnDef {
  id: string;
  title: string;
  statuses: DemandStatus[];
  primary: DemandStatus; // status escolhido ao mover para cá
  accent: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "novas", title: "Novas", statuses: ["recebida", "em_analise"], primary: "em_analise", accent: "from-blue-500/20 to-blue-500/5 border-blue-500/30" },
  { id: "pendentes", title: "Pendentes", statuses: ["aguardando_info", "aguardando_aprovacao"], primary: "aguardando_aprovacao", accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
  { id: "execucao", title: "Em execução", statuses: ["aprovada", "em_execucao", "pagamento_agendado"], primary: "em_execucao", accent: "from-violet-500/20 to-violet-500/5 border-violet-500/30" },
  { id: "concluidas", title: "Concluídas", statuses: ["comprovante_enviado", "finalizada"], primary: "finalizada", accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { id: "canceladas", title: "Canceladas / Reprovadas", statuses: ["cancelada", "reprovada"], primary: "cancelada", accent: "from-slate-400/20 to-slate-400/5 border-slate-400/30" },
];

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface Props {
  rows: InboxDemand[];
  onStatusChange: (id: string, status: DemandStatus) => void;
}

export function DemandsKanbanBoard({ rows, onStatusChange }: Props) {
  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map: Record<string, InboxDemand[]> = {};
    for (const col of COLUMNS) map[col.id] = [];
    for (const d of rows) {
      const col = COLUMNS.find((c) => c.statuses.includes(d.status as DemandStatus));
      if (col) map[col.id].push(d);
    }
    return map;
  }, [rows]);

  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id?.toString();
    const demandId = e.active.id.toString();
    if (!overId) return;
    const col = COLUMNS.find((c) => c.id === overId);
    if (!col) return;
    const demand = rows.find((d) => d.id === demandId);
    if (!demand) return;
    if (col.statuses.includes(demand.status as DemandStatus)) return; // mesma coluna
    onStatusChange(demandId, col.primary);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
        {COLUMNS.map((col) => (
          <Column key={col.id} col={col} demands={grouped[col.id] ?? []} onOpen={(id) => navigate(`/demands/${id}`)} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ col, demands, onOpen }: { col: ColumnDef; demands: InboxDemand[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[290px] max-w-[290px] rounded-2xl border bg-gradient-to-br backdrop-blur-xl p-3 snap-start transition-all",
        col.accent,
        isOver && "ring-2 ring-primary scale-[1.01]",
      )}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-xs font-semibold uppercase tracking-wider">{col.title}</div>
        <Badge variant="outline" className="bg-white/60 backdrop-blur-sm text-[10px] font-mono">{demands.length}</Badge>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {demands.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-6 italic">vazio</div>
        ) : demands.map((d) => (
          <KanbanCard key={d.id} demand={d} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ demand, onOpen }: { demand: InboxDemand; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: demand.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
  const overdue = demand.due_date && demand.due_date < new Date().toISOString().slice(0, 10)
    && demand.status !== "finalizada" && demand.status !== "cancelada";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm p-2.5 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners}
          className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onOpen(demand.id)} className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-mono text-[10px] text-muted-foreground truncate">{demand.demand_code ?? "—"}</span>
            <AsanaChip status={demand.asana_sync_status} url={demand.asana_task_url}
              taskId={demand.asana_task_id} lastSyncedAt={demand.asana_last_synced_at} />
          </div>
          <div className="font-medium text-sm line-clamp-2 mb-1">{demand.title}</div>
          {demand.supplier_name && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5 line-clamp-1">
              <Building2 className="w-3 h-3 shrink-0" />{demand.supplier_name}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono tabular-nums text-sm font-semibold">{fmtBRL(demand.amount)}</span>
            {demand.due_date && (
              <span className={cn("text-[11px] flex items-center gap-0.5", overdue ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
                <Calendar className="w-3 h-3" />{fmtDate(demand.due_date)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-2">
            <PriorityBadge priority={demand.priority} />
            <StatusBadge status={demand.status} />
          </div>
        </button>
      </div>
    </div>
  );
}
