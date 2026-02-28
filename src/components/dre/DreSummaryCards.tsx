import { HelpCircle, TrendingUp, TrendingDown, DollarSign, Receipt, Wallet, PiggyBank, Percent } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyBR } from "@/lib/currency";

interface DreSummaryCardsProps {
  faturamento: number;
  receitaLiquida: number;
  despesasTotais: number;
  resultado: number;
  margemLiquida: number | null;
  isConsistent?: boolean;
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatCurrencyBR(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

const cards = [
  {
    key: "faturamento",
    label: "Faturamento",
    tooltip: "Total de receitas brutas geradas no período.",
    icon: DollarSign,
    getValue: (p: DreSummaryCardsProps) => formatBRL(p.faturamento),
    getColor: () => "text-foreground",
  },
  {
    key: "deducoes",
    label: "Impostos e taxas",
    tooltip: "Impostos e deduções aplicadas sobre o faturamento.",
    icon: Receipt,
    getValue: (p: DreSummaryCardsProps) => formatBRL(p.receitaLiquida - p.faturamento),
    getColor: () => "text-foreground",
  },
  {
    key: "despesas",
    label: "Gastos do mês",
    tooltip: "Soma de todos os custos e despesas operacionais.",
    icon: Wallet,
    getValue: (p: DreSummaryCardsProps) => formatBRL(p.despesasTotais),
    getColor: () => "text-foreground",
  },
  {
    key: "resultado",
    label: "Lucro/Prejuízo",
    tooltip: "Quanto sobrou (lucro) ou faltou (prejuízo) no período.",
    icon: PiggyBank,
    getValue: (p: DreSummaryCardsProps) => formatBRL(p.resultado),
    getColor: (p: DreSummaryCardsProps) => p.resultado >= 0 ? "text-success" : "text-destructive",
    highlight: true,
  },
  {
    key: "margem",
    label: "Margem de lucro",
    tooltip: "Percentual do faturamento que virou lucro efetivo.",
    icon: Percent,
    getValue: (p: DreSummaryCardsProps) => formatPercent(p.margemLiquida),
    getColor: (p: DreSummaryCardsProps) =>
      p.margemLiquida !== null && p.margemLiquida > 0 ? "text-success" : p.margemLiquida !== null && p.margemLiquida < 0 ? "text-destructive" : "text-foreground",
  },
];

export function DreSummaryCards(props: DreSummaryCardsProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger-children">
        {cards.map((card) => {
          const Icon = card.icon;
          const colorClass = card.getColor(props);
          const isHighlight = card.highlight;

          return (
            <div
              key={card.key}
              className={`
                p-5 rounded-2xl transition-all duration-200
                ${isHighlight ? "liquid-glass-highlight" : "liquid-glass"}
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isHighlight ? "bg-primary/10" : "bg-muted/60"}`}>
                    <Icon className={`h-4 w-4 ${isHighlight ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {card.tooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={`text-xl lg:text-2xl font-bold tabular-nums ${colorClass}`}>
                {card.getValue(props)}
              </p>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
