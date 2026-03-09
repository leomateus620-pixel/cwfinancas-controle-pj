import type { ForecastMonthly } from "@/hooks/useForecast";
import { formatCurrencyBR } from "@/lib/currency";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

interface Props {
  forecastMonths: ForecastMonthly[];
  realMonths?: ForecastMonthly[];
}

export function ForecastCashFlow({ forecastMonths, realMonths = [] }: Props) {
  const items = forecastMonths.slice(0, 6);

  // Start accumulated balance from last real month's saldo
  const lastRealSaldo = realMonths.length > 0 ? realMonths[realMonths.length - 1].saldo_real : 0;
  let accumulated = lastRealSaldo;

  return (
    <div className="liquid-glass-caixa relative overflow-hidden p-6">
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Fluxo de Caixa Projetado
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Entradas, saídas, saldo mensal e acumulado
      </p>
      <div className="space-y-3">
        {items.map((item) => {
          const [year, mon] = item.month_key.split("-");
          const label = `${MONTH_LABELS[mon]} ${year}`;
          const rec = item.receita_prev_base || 0;
          const desp = item.despesa_prev_base || 0;
          const saldo = item.saldo_prev_base || 0;
          accumulated += saldo;

          return (
            <div
              key={item.month_key}
              className="liquid-glass-bank-card p-5 transition-all duration-300 ease-out hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${saldo >= 0 ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className="font-medium text-foreground">{label}</span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xl font-extrabold tabular-nums tracking-tight ${
                      saldo >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {saldo >= 0 ? "+" : ""}
                    {formatCurrencyBR(saldo)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-medium text-xs">
                    ↓ {formatCurrencyBR(rec)}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 font-medium text-xs">
                    ↑ {formatCurrencyBR(desp)}
                  </span>
                </div>
                <span className={`text-xs font-medium tabular-nums ${accumulated >= 0 ? "text-muted-foreground" : "text-red-500"}`}>
                  Acum: {formatCurrencyBR(accumulated)}
                </span>
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
