import { useState } from "react";
import { useBankBalances } from "@/hooks/useBankBalances";
import { formatCurrencyBR } from "@/lib/currency";
import { GlassCard } from "./GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Landmark, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankBalanceCardProps {
  periodKey?: string;
  delay?: number;
}

export function BankBalanceCard({ periodKey, delay = 0 }: BankBalanceCardProps) {
  const { rows, openingTotal, closingTotal, isLoading, isEmpty, periodKey: pk } = useBankBalances(periodKey);
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Format month label
  let monthLabel = "Mês atual";
  try {
    const d = parse(pk, "yyyy-MM", new Date());
    monthLabel = format(d, "MMMM yyyy", { locale: ptBR });
    monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  } catch { /* fallback */ }

  const visibleRows = expanded ? rows : rows.slice(0, 3);
  const hasMore = rows.length > 3;

  if (isLoading) {
    return (
      <GlassCard className="p-6" variant="highlight">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </GlassCard>
    );
  }

  if (isEmpty) {
    return (
      <GlassCard className="p-6" variant="highlight">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50">
            <Landmark className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Saldo Bancário</h3>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/70 text-center py-4">
          Saldo bancário não encontrado na planilha deste mês.
        </p>
      </GlassCard>
    );
  }

  const isClosingNegative = (closingTotal ?? 0) < 0;

  return (
    <>
      <GlassCard
        className={`p-6 animate-in fade-in slide-in-from-bottom-2`}
        variant="highlight"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Landmark className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Saldo Bancário</h3>
              <p className="text-xs text-muted-foreground">{monthLabel}</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Ver detalhes
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Saldo Inicial</p>
            <p className="text-lg font-bold text-foreground">
              {openingTotal !== null ? formatCurrencyBR(openingTotal) : "—"}
            </p>
          </div>
          <div className={`rounded-xl p-3 text-center ${isClosingNegative ? "bg-destructive/10" : "bg-muted/30"}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Saldo Final</p>
            <p className={`text-lg font-bold ${isClosingNegative ? "text-destructive" : "text-foreground"}`}>
              {closingTotal !== null ? formatCurrencyBR(closingTotal) : "—"}
            </p>
          </div>
        </div>

        {/* Bank list */}
        <div className="space-y-2">
          {visibleRows.map((row) => (
            <div key={row.id || row.bank_name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
              <span className="text-foreground/80 font-medium truncate max-w-[40%]">{row.bank_name}</span>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{row.opening_balance !== null ? formatCurrencyBR(row.opening_balance) : "—"}</span>
                <span className={(row.closing_balance ?? 0) < 0 ? "text-destructive" : ""}>
                  {row.closing_balance !== null ? formatCurrencyBR(row.closing_balance) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 mx-auto transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Ver menos" : `Ver mais (${rows.length - 3})`}
          </button>
        )}
      </GlassCard>

      {/* Detail Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Saldo Bancário — {monthLabel}</DrawerTitle>
            <DrawerDescription>Detalhamento por banco</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Inicial</p>
                <p className="text-base font-bold">{openingTotal !== null ? formatCurrencyBR(openingTotal) : "—"}</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${isClosingNegative ? "bg-destructive/10" : "bg-muted/30"}`}>
                <p className="text-xs text-muted-foreground mb-1">Total Final</p>
                <p className={`text-base font-bold ${isClosingNegative ? "text-destructive" : ""}`}>
                  {closingTotal !== null ? formatCurrencyBR(closingTotal) : "—"}
                </p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Banco</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Saldo Inicial</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Saldo Final</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.bank_name} className="border-b border-border/30">
                    <td className="py-2 text-foreground font-medium">{row.bank_name}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {row.opening_balance !== null ? formatCurrencyBR(row.opening_balance) : "—"}
                    </td>
                    <td className={`py-2 text-right ${(row.closing_balance ?? 0) < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {row.closing_balance !== null ? formatCurrencyBR(row.closing_balance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
