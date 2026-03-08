import { useState } from "react";
import { APRRecord, APRAggregates } from "@/hooks/usePayableReceivable";
import { StatusBadge } from "./StatusBadge";
import { TrendingUp, FileText, Eye, EyeOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

interface ReceivableCardProps {
  records: APRRecord[];
  aggregates: APRAggregates;
  isLoading: boolean;
}

export function ReceivableCard({ records, aggregates, isLoading }: ReceivableCardProps) {
  const [showDetails, setShowDetails] = useState(true);

  if (isLoading) {
    return (
      <div className="liquid-glass-card p-6 rounded-2xl">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="liquid-glass-card rounded-2xl p-6 border-l-4 border-l-emerald-400 relative">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, hsla(160, 84%, 39%, 0.12), transparent 70%)" }} />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, hsla(160, 84%, 39%, 0.08), transparent 70%)" }} />
      <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: "radial-gradient(circle, hsla(160, 70%, 50%, 0.06), transparent 70%)" }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 backdrop-blur-sm border border-emerald-400/20 shadow-[0_0_12px_-3px_hsla(160,84%,39%,0.2)]">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Contas a Receber</h3>
            <p className="text-[11px] text-muted-foreground">{records.length} registro{records.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
        >
          {showDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showDetails ? "Esconder" : "Detalhes"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="Total a Receber" value={formatCurrency(aggregates.total)} />
        <KPI label="Total Recebido" value={formatCurrency(aggregates.totalSettled)} accent="success" />
        <KPI label="Total Pendente" value={formatCurrency(aggregates.totalPending)} accent="warning" />
        <KPI label="Qtd Contas" value={String(aggregates.count)} />
      </div>

      {/* Table with transition */}
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: showDetails ? "500px" : "0px",
          opacity: showDetails ? 1 : 0,
        }}
      >
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma conta a receber neste período
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 backdrop-blur-sm border-b border-border/30">
                  <TableHead className="text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold">Nº NF</TableHead>
                  <TableHead className="text-xs font-semibold">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Forma Pgto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} className="text-sm hover:bg-emerald-50/30 transition-colors border-b border-border/20">
                    <TableCell className="font-medium max-w-[200px] truncate">{r.counterpart || r.description || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.nf_number || "—"}</TableCell>
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
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" }) {
  const valueColor = accent === "success"
    ? "text-emerald-600"
    : accent === "warning"
    ? "text-amber-600"
    : "text-foreground";

  return (
    <div className="bg-background/50 backdrop-blur-sm rounded-xl p-3 border border-border/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
