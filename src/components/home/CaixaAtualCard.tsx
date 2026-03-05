import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBankBalances } from "@/hooks/useBankBalances";
import { Wallet, ChevronRight, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCompactBR } from "@/lib/currency";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface CaixaAtualCardProps {
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  delay?: number;
}

const currentPeriodKey = format(new Date(), "yyyy-MM");
const monthLabel = format(new Date(), "MMMM yyyy", { locale: ptBR });

export function CaixaAtualCard({ currentBalance, monthIncome, monthExpense, delay = 0 }: CaixaAtualCardProps) {
  const { rows, isLoading, isEmpty } = useBankBalances(currentPeriodKey);
  const [open, setOpen] = useState(false);

  const hasBanks = rows.length > 0;
  const monthResult = monthIncome - monthExpense;

  return (
    <div
      className="opacity-0 animate-fade-in-up md:col-span-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard variant="highlight" className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 backdrop-blur-sm">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
                Caixa Atual
              </p>
              <p className="text-muted-foreground/50 text-[10px] capitalize mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              Saldo final de cada banco no mês corrente, extraído da planilha. Clique em "Ver detalhes" para o resumo completo.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Body — per-bank closing balances */}
        {hasBanks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map((row, idx) => {
              const closing = row.closing_balance ?? 0;
              const opening = row.opening_balance ?? 0;
              const delta = opening !== 0 ? ((closing - opening) / Math.abs(opening)) * 100 : 0;
              const isPositive = closing >= 0;
              const deltaPositive = delta >= 0;

              return (
                <div
                  key={row.id}
                  className="opacity-0 animate-fade-in-up relative rounded-xl border border-border/40 bg-gradient-to-br from-card/60 to-muted/30 backdrop-blur-md p-4 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
                  style={{ animationDelay: `${delay + 120 * (idx + 1)}ms`, animationFillMode: "forwards" }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {row.bank_name}
                  </p>
                  <div className="flex items-end justify-between gap-2">
                    <AnimatedValue
                      value={closing}
                      prefix="R$ "
                      format="currency"
                      decimals={2}
                      color={isPositive ? "success" : "danger"}
                      glow
                      className="text-2xl md:text-3xl"
                    />
                    {opening !== 0 && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                          deltaPositive
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        )}
                      >
                        {deltaPositive ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {deltaPositive ? "+" : ""}
                        {delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Fallback — transaction-based balance */
          <div>
            <AnimatedValue
              value={currentBalance}
              prefix="R$ "
              format="currency"
              decimals={2}
              color={currentBalance >= 0 ? "success" : "danger"}
              glow
              className="text-3xl md:text-4xl"
            />
            {!isLoading && isEmpty && (
              <p className="text-muted-foreground/50 text-[10px] mt-2">
                Saldo baseado em transações — importe saldos bancários para detalhamento por banco.
              </p>
            )}
          </div>
        )}

        {/* Footer — drawer trigger */}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors group">
              Ver detalhes
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Caixa Atual — {monthLabel}
              </DrawerTitle>
              <DrawerDescription>Detalhamento por banco e resumo do mês</DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-5 overflow-y-auto">
              {/* Per-bank breakdown */}
              {hasBanks && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldos por Banco
                  </h4>
                  {rows.map((row) => {
                    const opening = row.opening_balance ?? 0;
                    const closing = row.closing_balance ?? 0;
                    const delta = closing - opening;
                    const deltaPositive = delta >= 0;

                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-border/40 bg-gradient-to-br from-card/60 to-muted/20 p-4"
                      >
                        <p className="text-sm font-bold text-foreground mb-3">{row.bank_name}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Inicial</p>
                            <p className="text-sm font-semibold tabular-nums">{formatCompactBR(opening)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Final</p>
                            <p className={cn("text-sm font-semibold tabular-nums", closing >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {formatCompactBR(closing)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Variação</p>
                            <p className={cn("text-sm font-semibold tabular-nums flex items-center gap-1", deltaPositive ? "text-emerald-600" : "text-red-600")}>
                              {deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {formatCompactBR(Math.abs(delta))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Monthly summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Movimentações do Mês
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/40 bg-emerald-500/5 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Entradas</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCompactBR(monthIncome)}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-red-500/5 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Saídas</p>
                    <p className="text-lg font-bold tabular-nums text-red-600">{formatCompactBR(monthExpense)}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-primary/5 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Resultado</p>
                    <p className={cn("text-lg font-bold tabular-nums", monthResult >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {formatCompactBR(monthResult)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </GlassCard>
    </div>
  );
}
