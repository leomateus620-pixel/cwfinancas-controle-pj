import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { AnimatedValue } from "@/components/ui/animated-value";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBankBalances } from "@/hooks/useBankBalances";
import { Wallet, ChevronRight, TrendingUp, TrendingDown, ArrowDownRight } from "lucide-react";
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
import bankCaixinhaImg from "@/assets/bank-caixinha.png";
import bankSicrediImg from "@/assets/bank-sicredi.jpg";

interface CaixaAtualCardProps {
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  delay?: number;
}

const currentPeriodKey = format(new Date(), "yyyy-MM");
const monthLabel = format(new Date(), "MMMM yyyy", { locale: ptBR });

function getBankLogo(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("caixinha")) return bankCaixinhaImg;
  if (n.includes("sicredi")) return bankSicrediImg;
  return null;
}

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
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60">
              <Wallet className="w-[18px] h-[18px] text-foreground/60" />
            </div>
            <div>
              <p className="text-foreground/80 text-[11px] font-semibold uppercase tracking-widest">
                Caixa Atual
              </p>
              <p className="text-muted-foreground/70 text-[10px] capitalize mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors text-xs">ⓘ</button>
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
              const deltaPositive = delta >= 0;
              const logo = getBankLogo(row.bank_name);

              return (
                <div
                  key={row.id}
                  className="opacity-0 animate-fade-in-up relative rounded-2xl border border-white/40 dark:border-border/30 bg-white/60 dark:bg-card/50 backdrop-blur-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-300 hover:bg-white/70 dark:hover:bg-card/60"
                  style={{ animationDelay: `${delay + 120 * (idx + 1)}ms`, animationFillMode: "forwards" }}
                >
                  {/* Bank identity */}
                  <div className="flex flex-col items-center mb-3">
                    {logo ? (
                      <img
                        src={logo}
                        alt={row.bank_name}
                        className="w-12 h-12 rounded-xl object-contain bg-white/80 dark:bg-muted/30 p-1 border border-white/50 dark:border-border/20 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted/40 border border-white/50 dark:border-border/20">
                        <Wallet className="w-5 h-5 text-muted-foreground/60" />
                      </div>
                    )}
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground/80 uppercase mt-2">
                      {row.bank_name}
                    </p>
                  </div>

                  {/* Value + delta */}
                  <div className="flex items-end justify-between gap-2">
                    <AnimatedValue
                      value={closing}
                      prefix="R$ "
                      format="currency"
                      decimals={2}
                      color="default"
                      className="text-[1.6rem] md:text-[1.75rem] font-bold tracking-tight text-foreground"
                    />
                    {opening !== 0 && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full",
                          deltaPositive
                            ? "text-muted-foreground/60 bg-muted/30"
                            : "text-destructive/60 bg-destructive/5"
                        )}
                      >
                        <ArrowDownRight className={cn("w-3 h-3", deltaPositive && "rotate-180")} />
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
              color="default"
              className="text-3xl md:text-4xl font-bold text-foreground"
            />
            {!isLoading && isEmpty && (
              <p className="text-muted-foreground/40 text-[10px] mt-2">
                Saldo baseado em transações — importe saldos bancários para detalhamento por banco.
              </p>
            )}
          </div>
        )}

        {/* Footer — drawer trigger */}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors group">
              Ver detalhes
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2 text-foreground">
                <Wallet className="w-5 h-5 text-muted-foreground" />
                Caixa Atual — {monthLabel}
              </DrawerTitle>
              <DrawerDescription>Detalhamento por banco e resumo do mês</DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-5 overflow-y-auto">
              {/* Per-bank breakdown */}
              {hasBanks && (
                <div className="space-y-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Saldos por Banco
                  </h4>
                  {rows.map((row) => {
                    const opening = row.opening_balance ?? 0;
                    const closing = row.closing_balance ?? 0;
                    const delta = closing - opening;
                    const deltaPositive = delta >= 0;
                    const logo = getBankLogo(row.bank_name);

                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-white/40 dark:border-border/30 bg-white/60 dark:bg-card/40 backdrop-blur-xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {logo ? (
                            <img
                              src={logo}
                              alt={row.bank_name}
                              className="w-10 h-10 rounded-xl object-contain bg-white/80 dark:bg-muted/30 p-1 border border-white/50 dark:border-border/20 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/40">
                              <Wallet className="w-4.5 h-4.5 text-muted-foreground/60" />
                            </div>
                          )}
                          <p className="text-sm font-semibold text-foreground">{row.bank_name}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Inicial</p>
                            <p className="text-sm font-medium tabular-nums text-foreground">{formatCompactBR(opening)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Final</p>
                            <p className="text-sm font-medium tabular-nums text-foreground">{formatCompactBR(closing)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Variação</p>
                            <p className={cn(
                              "text-sm font-medium tabular-nums flex items-center gap-1",
                              deltaPositive ? "text-foreground" : "text-destructive"
                            )}>
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
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Movimentações do Mês
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/40 dark:border-border/30 bg-white/60 dark:bg-card/40 backdrop-blur-xl p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Entradas</p>
                    <p className="text-base font-semibold tabular-nums text-foreground">{formatCompactBR(monthIncome)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/40 dark:border-border/30 bg-white/60 dark:bg-card/40 backdrop-blur-xl p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Saídas</p>
                    <p className="text-base font-semibold tabular-nums text-foreground">{formatCompactBR(monthExpense)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/40 dark:border-border/30 bg-white/60 dark:bg-card/40 backdrop-blur-xl p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider mb-1">Resultado</p>
                    <p className={cn(
                      "text-base font-semibold tabular-nums",
                      monthResult >= 0 ? "text-foreground" : "text-destructive"
                    )}>
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
