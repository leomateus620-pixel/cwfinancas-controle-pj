import { ArrowRight, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrencyBR } from "@/lib/currency";

interface DreStoryFlowProps {
  faturamento: number;
  despesasTotais: number;
  receitaLiquida: number;
  resultado: number;
}

function formatBRL(value: number): string {
  return formatCurrencyBR(value);
}

export function DreStoryFlow({ faturamento, despesasTotais, receitaLiquida, resultado }: DreStoryFlowProps) {
  const saiu = Math.abs(faturamento - receitaLiquida) + Math.abs(despesasTotais);

  const steps = [
    {
      key: "entrou",
      title: "Entrou",
      value: faturamento,
      description: "Faturamento bruto do período",
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/8",
      borderColor: "border-primary/15",
    },
    {
      key: "saiu",
      title: "Saiu",
      value: -saiu,
      description: "Impostos, custos e despesas",
      icon: TrendingDown,
      color: "text-warning",
      bgColor: "bg-warning/8",
      borderColor: "border-warning/15",
    },
    {
      key: "sobrou",
      title: "Sobrou",
      value: resultado,
      description: resultado >= 0 ? "Lucro do período" : "Prejuízo do período",
      icon: resultado >= 0 ? TrendingUp : TrendingDown,
      color: resultado >= 0 ? "text-success" : "text-destructive",
      bgColor: resultado >= 0 ? "bg-success/8" : "bg-destructive/8",
      borderColor: resultado >= 0 ? "border-success/15" : "border-destructive/15",
    },
  ];

  return (
    <div className="liquid-glass p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
        Resumo simplificado
      </h3>
      <div className="flex items-stretch gap-2 lg:gap-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-center gap-2 lg:gap-4 flex-1">
              <div className={`flex-1 p-4 rounded-xl border ${step.borderColor} ${step.bgColor} transition-all duration-200`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${step.color}`} />
                  <span className={`text-sm font-semibold ${step.color}`}>{step.title}</span>
                </div>
                <p className={`text-lg lg:text-xl font-bold tabular-nums ${step.color}`}>
                  {formatBRL(step.value)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{step.description}</p>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground/30 shrink-0 hidden lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
