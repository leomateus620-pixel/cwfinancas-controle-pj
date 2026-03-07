import { GlassCard } from "@/components/home/GlassCard";
import { APRRecord, APRAggregates } from "@/hooks/usePayableReceivable";
import { StatusBadge } from "./StatusBadge";
import { TrendingDown, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

interface PayableCardProps {
  records: APRRecord[];
  aggregates: APRAggregates;
  isLoading: boolean;
}

export function PayableCard({ records, aggregates, isLoading }: PayableCardProps) {
  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-40" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 border-l-4 border-l-amber-400">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 rounded-lg bg-amber-50">
          <TrendingDown className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Contas a Pagar</h3>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI label="Total a Pagar" value={formatCurrency(aggregates.total)} />
        <KPI label="Total Pago" value={formatCurrency(aggregates.totalSettled)} accent="success" />
        <KPI label="Total Pendente" value={formatCurrency(aggregates.totalPending)} accent="warning" />
        <KPI label="Qtd Contas" value={String(aggregates.count)} />
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhuma conta a pagar neste período
        </div>
      ) : (
        <div className="max-h-[400px] overflow-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs">Vencimento</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Forma Pgto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id} className="text-sm">
                  <TableCell className="font-medium max-w-[200px] truncate">{r.description || "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[140px] truncate">{r.counterpart || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.due_date)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                  <TableCell><StatusBadge status={r.status_normalized} /></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.payment_method || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </GlassCard>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" }) {
  const valueColor = accent === "success"
    ? "text-emerald-600"
    : accent === "warning"
    ? "text-amber-600"
    : "text-foreground";

  return (
    <div className="bg-background/60 rounded-lg p-3 border border-border/30">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
