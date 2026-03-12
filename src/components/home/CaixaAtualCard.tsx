import { useState } from "react";
import { AnimatedValue } from "@/components/ui/animated-value";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBankBalances, useAllBankBalancePeriods } from "@/hooks/useBankBalances";
import { Wallet, ChevronRight, TrendingUp, TrendingDown, ArrowDownRight } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCompactBR } from "@/lib/currency";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import bankCaixinhaImg from "@/assets/bank-caixinha.png";
import bankSicrediImg from "@/assets/bank-sicredi.jpg";
import bankAsaasImg from "@/assets/bank-asaas.png";

interface CaixaAtualCardProps {
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  delay?: number;
}

const currentPeriodKey = format(new Date(), "yyyy-MM");

function getBankLogo(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("caixinha")) return bankCaixinhaImg;
  if (n.includes("sicredi")) return bankSicrediImg;
  if (n.includes("asaas")) return bankAsaasImg;
  return null;
}

function getBankColor(name: string): { text: string; accent: string } {
  const n = name.toLowerCase();
  if (n.includes("asaas")) return { text: "text-[hsl(221,72%,48%)]", accent: "bg-[hsl(221,72%,48%)]/8" };
  if (n.includes("sicredi")) return { text: "text-[hsl(135,55%,35%)]", accent: "bg-[hsl(135,55%,35%)]/8" };
  if (n.includes("caixinha")) return { text: "text-[hsl(42,70%,32%)]", accent: "bg-[hsl(42,70%,32%)]/8" };
  return { text: "text-foreground/70", accent: "bg-muted/30" };
}

function formatPeriodLabel(periodKey: string): string {
  try {
    const d = parse(periodKey, "yyyy-MM", new Date());
    return format(d, "MMM yyyy", { locale: ptBR });
  } catch {
    return periodKey;
  }
}

function formatPeriodShort(periodKey: string): string {
  try {
    const d = parse(periodKey, "yyyy-MM", new Date());
    return format(d, "MMM", { locale: ptBR });
  } catch {
    return periodKey;
  }
}

function MonthSelector({
  periods,
  selected,
  onSelect,
}: {
  periods: string[];
  selected: string;
  onSelect: (pk: string) => void;
}) {
  if (periods.length <= 1) return null;
  return (
    <div className="flex gap-1.5 flex-wrap mb-5">
      {periods.map((pk) => (
        <button
          key={pk}
          onClick={() => onSelect(pk)}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-200",
            pk === selected
              ? "liquid-glass-chip-active text-primary"
              : "liquid-glass-chip text-muted-foreground/60 hover:text-muted-foreground/80"
          )}
        >
          {formatPeriodShort(pk)}
        </button>
      ))}
    </div>
  );
}

function ComparisonBar({
  currentTotal,
  previousTotal,
}: {
  currentTotal: number | null;
  previousTotal: number | null;
}) {
  if (currentTotal === null || previousTotal === null || previousTotal === 0) return null;
  const delta = ((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100;
  const positive = delta >= 0;

  return (
    <div className="mt-5 flex items-center gap-2.5 px-2 py-2 rounded-xl liquid-glass-chip">
      <span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">vs mês anterior</span>
      <span
        className={cn(
          "flex items-center gap-1 text-[10px] font-bold tabular-nums px-2.5 py-1 rounded-full",
          positive
            ? "text-[hsl(160,84%,30%)] bg-[hsl(160,84%,39%)]/10"
            : "text-[hsl(0,72%,45%)] bg-[hsl(0,72%,51%)]/8"
        )}
      >
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {positive ? "+" : ""}
        {delta.toFixed(1)}%
      </span>
      <span className="text-[10px] text-foreground/35 tabular-nums font-medium">
        {formatCompactBR(previousTotal)} → {formatCompactBR(currentTotal)}
      </span>
    </div>
  );
}

/* ─── Compact card when no bank balances exist ─── */
function CompactCaixaCard({ currentBalance, delay }: { currentBalance: number; delay: number }) {
  const navigate = useNavigate();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              Saldo atual calculado com base nas transações importadas. Importe saldos bancários para detalhamento por banco.
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Caixa Atual</p>
        <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {formatCompactBR(currentBalance)}
        </p>

        <button
          onClick={() => navigate("/cash-flow")}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors group"
        >
          Ver detalhes
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </GlassCard>
    </div>
  );
}

/* ─── Expanded card with bank balances ─── */
function ExpandedCaixaCard({
  currentBalance,
  monthIncome,
  monthExpense,
  delay,
}: CaixaAtualCardProps) {
  const { periods } = useAllBankBalancePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriodKey);
  const { rows, isLoading, isEmpty, previousClosingTotal, closingTotal } = useBankBalances(selectedPeriod);
  const [open, setOpen] = useState(false);

  const hasBanks = rows.length > 0;
  const monthResult = monthIncome - monthExpense;
  const selectedLabel = formatPeriodLabel(selectedPeriod);
  const allPeriods = periods.includes(currentPeriodKey) ? periods : [...periods, currentPeriodKey].sort();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="liquid-glass-caixa p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/6 border border-primary/8">
              <Wallet className="w-[18px] h-[18px] text-primary/60" />
            </div>
            <div>
              <p className="text-foreground/85 text-[12px] font-bold uppercase tracking-[0.15em]">
                Caixa Atual
              </p>
              <p className="text-foreground/45 text-[10px] capitalize mt-0.5 font-medium">{selectedLabel}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-foreground/25 hover:text-foreground/50 transition-colors text-xs mt-1">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              Saldo final de cada banco no mês selecionado, extraído da planilha. Selecione um mês para comparar.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Month selector */}
        <MonthSelector periods={allPeriods} selected={selectedPeriod} onSelect={setSelectedPeriod} />

        {/* Body — per-bank closing balances */}
        {hasBanks ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map((row, idx) => {
                const closing = row.closing_balance ?? 0;
                const opening = row.opening_balance ?? 0;
                const delta = opening !== 0 ? ((closing - opening) / Math.abs(opening)) * 100 : 0;
                const deltaPositive = delta >= 0;
                const logo = getBankLogo(row.bank_name);
                const bankColor = getBankColor(row.bank_name);

                return (
                  <div
                    key={row.id}
                    className="opacity-0 animate-fade-in-up liquid-glass-bank-card p-5 md:p-6"
                    style={{ animationDelay: `${delay + 120 * (idx + 1)}ms`, animationFillMode: "forwards" }}
                  >
                    <div className="flex flex-col items-center mb-4">
                      {logo ? (
                        <div className="rounded-xl bg-white/70 p-1.5 border border-white/50 shadow-sm">
                          <img src={logo} alt={row.bank_name} className="h-10 w-auto max-w-[120px] rounded-lg object-contain" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted/30 border border-white/50">
                          <Wallet className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <p className={cn("text-[11px] font-bold tracking-[0.15em] uppercase mt-2.5", bankColor.text)}>
                        {row.bank_name}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/40 mb-1">Saldo Final</p>
                        <p className="text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                          {formatCompactBR(closing)}
                        </p>
                      </div>
                      <div className="border-t border-foreground/[0.04]" />
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/35 mb-0.5">Saldo Inicial</p>
                        <p className="text-sm font-medium tabular-nums text-foreground/55">{formatCompactBR(opening)}</p>
                      </div>
                      {opening !== 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums px-2 py-1 rounded-full",
                            deltaPositive
                              ? "text-[hsl(160,84%,30%)] bg-[hsl(160,84%,39%)]/8"
                              : "text-[hsl(0,60%,48%)] bg-[hsl(0,72%,51%)]/6"
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
            <ComparisonBar currentTotal={closingTotal} previousTotal={previousClosingTotal} />
          </>
        ) : (
          <div>
            <AnimatedValue
              value={currentBalance}
              prefix="R$ "
              format="currency"
              decimals={2}
              color="default"
              className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight"
            />
            {!isLoading && isEmpty && (
              <p className="text-foreground/35 text-[10px] mt-3 font-medium">
                Saldo baseado em transações — importe saldos bancários para detalhamento por banco.
              </p>
            )}
          </div>
        )}

        {/* Footer — drawer trigger */}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <button className="mt-5 flex items-center gap-1.5 text-[11px] font-medium text-foreground/40 hover:text-primary/70 transition-all duration-200 group">
              Ver detalhes
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2.5 text-foreground">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/6 border border-primary/8">
                  <Wallet className="w-4 h-4 text-primary/60" />
                </div>
                Caixa Atual — {selectedLabel}
              </DrawerTitle>
              <DrawerDescription className="text-foreground/45">
                Detalhamento por banco e resumo do mês
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-5 pb-8 space-y-6 overflow-y-auto">
              {hasBanks && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 pb-1 border-b border-foreground/[0.04]">
                    Saldos por Banco
                  </h4>
                  {rows.map((row) => {
                    const opening = row.opening_balance ?? 0;
                    const closing = row.closing_balance ?? 0;
                    const delta = closing - opening;
                    const deltaPositive = delta >= 0;
                    const logo = getBankLogo(row.bank_name);
                    const bankColor = getBankColor(row.bank_name);

                    return (
                      <div key={row.id} className="liquid-glass-detail-card p-5">
                        <div className="flex items-center gap-3 mb-4">
                          {logo ? (
                            <div className="rounded-xl bg-white/70 p-1.5 border border-white/50 shadow-sm">
                              <img src={logo} alt={row.bank_name} className="h-10 w-auto max-w-[120px] rounded-lg object-contain" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/30">
                              <Wallet className="w-4.5 h-4.5 text-muted-foreground/50" />
                            </div>
                          )}
                          <p className={cn("text-sm font-bold", bankColor.text)}>{row.bank_name}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Inicial</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground/75">{formatCompactBR(opening)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Final</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{formatCompactBR(closing)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Variação</p>
                            <p className={cn(
                              "text-sm font-semibold tabular-nums flex items-center gap-1",
                              deltaPositive ? "text-[hsl(160,84%,30%)]" : "text-[hsl(0,60%,48%)]"
                            )}>
                              {deltaPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {formatCompactBR(Math.abs(delta))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 pb-1 border-b border-foreground/[0.04]">
                  Movimentações do Mês
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="liquid-glass-detail-card p-4 text-center">
                    <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-2">Entradas</p>
                    <p className="text-base font-bold tabular-nums text-foreground">{formatCompactBR(monthIncome)}</p>
                  </div>
                  <div className="liquid-glass-detail-card p-4 text-center">
                    <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-2">Saídas</p>
                    <p className="text-base font-bold tabular-nums text-foreground">{formatCompactBR(monthExpense)}</p>
                  </div>
                  <div className="liquid-glass-detail-card p-4 text-center">
                    <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-2">Resultado</p>
                    <p className={cn(
                      "text-base font-bold tabular-nums",
                      monthResult >= 0 ? "text-[hsl(160,84%,30%)]" : "text-[hsl(0,60%,48%)]"
                    )}>
                      {formatCompactBR(monthResult)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

/* ─── Main export: decides compact vs expanded ─── */
export function CaixaAtualCard(props: CaixaAtualCardProps) {
  const { rows, isLoading } = useBankBalances(currentPeriodKey);
  const hasBankData = !isLoading && rows.length > 0;

  // While loading, render compact to avoid layout jump
  if (isLoading || !hasBankData) {
    return <CompactCaixaCard currentBalance={props.currentBalance} delay={props.delay ?? 0} />;
  }

  return <ExpandedCaixaCard {...props} />;
}
