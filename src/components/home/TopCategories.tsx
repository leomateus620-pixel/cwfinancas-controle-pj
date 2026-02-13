import { GlassCard } from "./GlassCard";
import { formatCurrencyBR } from "@/lib/currency";

interface TopCategoriesProps {
  categories: Array<{ name: string; value: number; percent: number }>;
  delay?: number;
}

export function TopCategories({ categories, delay = 0 }: TopCategoriesProps) {
  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full">
        <h3 className="text-foreground/90 font-semibold text-sm mb-4">Top Despesas</h3>

        {categories.length === 0 ? (
          <p className="text-muted-foreground/50 text-xs">Sem despesas este mês</p>
        ) : (
          <div className="space-y-4">
            {categories.map((cat, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-muted-foreground text-xs font-medium">{cat.name}</span>
                  <span className="text-muted-foreground/70 text-[11px] tabular-nums">{formatCurrencyBR(cat.value)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(cat.percent, 100)}%`,
                      background: "linear-gradient(90deg, hsl(221 85% 53%), hsl(173 80% 40%))",
                    }}
                  />
                </div>
                <p className="text-muted-foreground/50 text-[10px] tabular-nums mt-0.5">{Math.round(cat.percent)}% do total</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
