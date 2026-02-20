import { useNavigate } from "react-router-dom";
import { GlassCard } from "./GlassCard";
import { formatCurrencyBR } from "@/lib/currency";
import { ArrowRight } from "lucide-react";

interface TopCategoriesProps {
  categories: Array<{ name: string; value: number; percent: number }>;
  delay?: number;
}

export function TopCategories({ categories, delay = 0 }: TopCategoriesProps) {
  const navigate = useNavigate();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard className="p-5 md:p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground/90 font-semibold text-sm">Top Despesas</h3>
          <button
            onClick={() => navigate("/expenses")}
            className="flex items-center gap-1 text-primary/70 hover:text-primary text-[11px] font-medium transition-colors"
          >
            Ver detalhes
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-muted-foreground/50 text-xs">Sem despesas este mês</p>
        ) : (
          <div className="space-y-3 flex-1">
            {categories.map((cat, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-xs font-medium truncate max-w-[140px]">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/80 text-[11px] font-semibold tabular-nums">{formatCurrencyBR(cat.value)}</span>
                    <span className="text-muted-foreground/50 text-[10px] tabular-nums w-10 text-right">{cat.percent.toFixed(1)}%</span>
                  </div>
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
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
