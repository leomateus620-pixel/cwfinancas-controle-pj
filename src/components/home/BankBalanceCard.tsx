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
import { Landmark, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatedValue } from "@/components/ui/animated-value";

interface BankBalanceCardProps {
  periodKey?: string;
  delay?: number;
}

export function BankBalanceCard({ periodKey, delay = 0 }: BankBalanceCardProps) {
  const { rows, isLoading, isEmpty, periodKey: pk } = useBankBalances(periodKey);
  const [drawerOpen, setDrawerOpen] = useState(false);

  let monthLabel = "Mês atual";
  try {
    const d = parse(pk, "yyyy-MM", new Date());
    monthLabel = format(d, "MMMM yyyy", { locale: ptBR });
    monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  } catch { /* fallback */ }

  if (isLoading) {
    return (
      <GlassCard className="p-6" variant="highlight">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
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

  return (
    <>
      <GlassCard
        className="p-6 animate-in fade-in slide-in-from-bottom-2"
        variant="highlight"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shadow-sm">
              <Landmark className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">Saldo Bancário</h3>
              <p className="text-xs text-muted-foreground/70">{monthLabel}</p>
            </div>
          </div>
          {rows.length > 2 && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Ver detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Individual Bank Cards */}
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const opening = row.opening_balance ?? 0;
            const closing = row.closing_balance ?? 0;
            const delta = closing - opening;
            const deltaPercent = opening !== 0 ? (delta / Math.abs(opening)) * 100 : 0;
            const isNegativeDelta = delta < 0;
            const isPositiveDelta = delta > 0;

            return (
              <div
                key={row.id || row.bank_name}
                className="relative rounded-2xl border border-border/40 bg-gradient-to-br from-card/80 to-muted/20 p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-border/60 group"
                style={{ animationDelay: `${(idx + 1) * 120}ms` }}
              >
                {/* Bank Name + Delta Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    <span className="text-sm font-semibold text-foreground tracking-tight">
                      {row.bank_name}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                      isPositiveDelta
                        ? "bg-emerald-500/10 text-emerald-600"
                        : isNegativeDelta
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {isPositiveDelta ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : isNegativeDelta ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    {Math.abs(deltaPercent).toFixed(1)}%
                  </div>
                </div>

                {/* Values Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                      Saldo Inicial
                    </p>
                    <p className="text-base font-bold text-foreground tabular-nums">
                      <AnimatedValue
                        value={opening}
                        prefix="R$ "
                        format="currency"
                        decimals={2}
                        duration={1200 + idx * 200}
                        color="default"
                      />
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                      Saldo Final
                    </p>
                    <p className={`text-base font-bold tabular-nums ${
                      (row.closing_balance ?? 0) < 0 ? "text-destructive" : "text-foreground"
                    }`}>
                      <AnimatedValue
                        value={closing}
                        prefix="R$ "
                        format="currency"
                        decimals={2}
                        duration={1400 + idx * 200}
                        color={(row.closing_balance ?? 0) < 0 ? "danger" : "default"}
                      />
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Detail Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Saldo Bancário — {monthLabel}</DrawerTitle>
            <DrawerDescription>Detalhamento por banco</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto space-y-3">
            {rows.map((row) => {
              const opening = row.opening_balance ?? 0;
              const closing = row.closing_balance ?? 0;
              const delta = closing - opening;

              return (
                <div key={row.id || row.bank_name} className="rounded-xl border border-border/40 p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">{row.bank_name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Inicial</p>
                      <p className="text-sm font-bold">{formatCurrencyBR(opening)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Final</p>
                      <p className={`text-sm font-bold ${closing < 0 ? "text-destructive" : ""}`}>
                        {formatCurrencyBR(closing)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Variação</p>
                      <p className={`text-sm font-bold ${delta < 0 ? "text-destructive" : delta > 0 ? "text-emerald-600" : ""}`}>
                        {delta >= 0 ? "+" : ""}{formatCurrencyBR(delta)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
