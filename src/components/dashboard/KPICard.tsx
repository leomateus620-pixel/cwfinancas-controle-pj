import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedValue } from "@/components/ui/animated-value";
import { TrendBadge } from "@/components/ui/trend-badge";

interface KPICardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  valueColor?: "default" | "success" | "danger" | "primary";
  className?: string;
  decimals?: number;
}

export function KPICard({
  title,
  value,
  prefix = "",
  suffix = "",
  change,
  changeLabel,
  icon,
  trend = "neutral",
  valueColor = "default",
  className,
  decimals = 0,
}: KPICardProps) {
  const isNumericValue = typeof value === "number";

  const getValueColorClass = () => {
    switch (valueColor) {
      case "primary": return "text-primary";
      case "success": return "text-success";
      case "danger": return "text-destructive";
      default: return "text-foreground";
    }
  };

  return (
    <div 
      className={cn(
        "group relative bg-card/95 glass-premium rounded-2xl p-6 border border-border/50",
        "shadow-premium-md hover:shadow-premium-lg transition-premium",
        "animate-corporate-enter hover:-translate-y-1",
        valueColor === "primary" && "hover-glow-primary",
        valueColor === "success" && "hover-glow-success",
        valueColor === "danger" && "hover-glow-danger",
        className
      )}
    >
      {/* Gradient overlay on hover */}
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
        valueColor === "primary" && "bg-gradient-to-br from-primary/5 via-transparent to-transparent",
        valueColor === "success" && "bg-gradient-to-br from-success/5 via-transparent to-transparent",
        valueColor === "danger" && "bg-gradient-to-br from-destructive/5 via-transparent to-transparent"
      )} />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
            valueColor === "primary" && "bg-primary/10 text-primary",
            valueColor === "success" && "bg-success/10 text-success",
            valueColor === "danger" && "bg-destructive/10 text-destructive",
            valueColor === "default" && "bg-muted text-foreground"
          )}>
            <div className="group-hover:animate-float">
              {icon}
            </div>
          </div>
          {change !== undefined && (
            <TrendBadge 
              value={trend === "down" ? -Math.abs(change) : change}
              size="sm"
              animated={trend === "up"}
            />
          )}
        </div>

        {/* Value */}
        <div className="mb-3">
          {isNumericValue ? (
            <AnimatedValue
              value={value as number}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              className="text-3xl md:text-4xl tracking-tight"
              color={valueColor}
              glow
              format="currency"
              duration={1800}
            />
          ) : (
            <span className={cn(
              "text-3xl md:text-4xl font-bold tracking-tight animate-count-emphasis",
              getValueColorClass()
            )}>
              {value}
            </span>
          )}
        </div>

        {/* Title and change label */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
          {changeLabel && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>

        {/* Progress bar indicator */}
        <div className="mt-4 h-1 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              valueColor === "primary" && "bg-primary",
              valueColor === "success" && "bg-success",
              valueColor === "danger" && "bg-destructive",
              valueColor === "default" && "bg-foreground/30"
            )}
            style={{ 
              width: `${Math.min((change || 0) * 4 + 50, 100)}%`,
              animation: 'progress-fill 1.5s ease-out forwards'
            }}
          />
        </div>
      </div>
    </div>
  );
}
