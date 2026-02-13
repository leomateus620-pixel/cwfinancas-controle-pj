import type { ForecastMonthly } from "@/hooks/useForecast";
import { formatCurrencyBR } from "@/lib/currency";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

interface Props {
  forecastMonths: ForecastMonthly[];
}

export function ForecastCashFlow({ forecastMonths }: Props) {
  const items = forecastMonths.slice(0, 6);

  return (
    <div className="liquid-glass-navy p-6">
      <h3 className="text-lg font-semibold text-[#0a1940] mb-1">
        Fluxo de Caixa Projetado
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Entradas, saídas e saldo previsto
      </p>
      <div className="space-y-3">
        {items.map((item) => {
          const [year, mon] = item.month_key.split("-");
          const label = `${MONTH_LABELS[mon]} ${year}`;
          const rec = item.receita_prev_base || 0;
          const desp = item.despesa_prev_base || 0;
          const saldo = item.saldo_prev_base || 0;

          return (
            <div
              key={item.month_key}
              className="p-4 rounded-xl bg-white/40 border border-white/60"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[#0a1940]">{label}</span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    saldo >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {saldo >= 0 ? "+" : ""}
                  {formatCurrencyBR(saldo)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-success">↓ {formatCurrencyBR(rec)}</span>
                <span className="text-destructive">↑ {formatCurrencyBR(desp)}</span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Gere uma previsão para ver o fluxo projetado.
          </p>
        )}
      </div>
    </div>
  );
}
