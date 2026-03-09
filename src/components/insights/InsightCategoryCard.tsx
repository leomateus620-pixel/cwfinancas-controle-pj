import { LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightVariant = "health" | "risk" | "opportunity" | "anomaly";

interface InsightMetric {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

interface InsightCategoryCardProps {
  variant: InsightVariant;
  icon: LucideIcon;
  title: string;
  summary: string;
  priority: "alta" | "média" | "baixa";
  metrics: InsightMetric[];
  itemCount: number;
  isExpanded: boolean;
  onClick: () => void;
}

const variantConfig: Record<InsightVariant, {
  accent: string;
  iconBg: string;
  iconColor: string;
  borderAccent: string;
  glowHover: string;
}> = {
  health: {
    accent: "from-primary/8 to-primary/2",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    borderAccent: "hover:border-primary/20",
    glowHover: "hover:shadow-[0_8px_32px_rgba(45,126,243,0.08)]",
  },
  risk: {
    accent: "from-warning/8 to-warning/2",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    borderAccent: "hover:border-warning/20",
    glowHover: "hover:shadow-[0_8px_32px_rgba(234,179,8,0.08)]",
  },
  opportunity: {
    accent: "from-success/8 to-success/2",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    borderAccent: "hover:border-success/20",
    glowHover: "hover:shadow-[0_8px_32px_rgba(13,152,102,0.08)]",
  },
  anomaly: {
    accent: "from-destructive/6 to-destructive/2",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    borderAccent: "hover:border-destructive/20",
    glowHover: "hover:shadow-[0_8px_32px_rgba(220,38,38,0.06)]",
  },
};

const priorityColors: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive",
  média: "bg-warning/10 text-warning",
  baixa: "bg-success/10 text-success",
};

export function InsightCategoryCard({
  variant,
  icon: Icon,
  title,
  summary,
  priority,
  metrics,
  itemCount,
  isExpanded,
  onClick,
}: InsightCategoryCardProps) {
  const config = variantConfig[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        "liquid-glass-card w-full text-left p-5 cursor-pointer group",
        "transition-all duration-250",
        config.borderAccent,
        config.glowHover,
        isExpanded && "ring-1 ring-primary/15"
      )}
    >
      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 rounded-[20px] bg-gradient-to-br opacity-60 pointer-events-none",
          config.accent
        )}
      />

      <div className="relative z-[2] flex flex-col gap-3.5">
        {/* Top row: icon + priority */}
        <div className="flex items-start justify-between">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.iconBg)}>
            <Icon className={cn("w-5 h-5", config.iconColor)} />
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", priorityColors[priority])}>
            {priority}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>

        {/* Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{summary}</p>

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="flex items-center gap-3">
            {metrics.slice(0, 2).map((m, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{m.label}</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-1.5 transition-all">
            Ver detalhes
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
