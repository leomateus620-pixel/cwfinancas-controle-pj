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

  const getIconContainerClass = () => {
    switch (valueColor) {
      case "primary": return "bg-primary/8 ring-1 ring-primary/10 text-primary";
      case "success": return "bg-success/8 ring-1 ring-success/10 text-success";
      case "danger": return "bg-destructive/8 ring-1 ring-destructive/10 text-destructive";
      default: return "bg-muted/60 ring-1 ring-border/40 text-muted-foreground";
    }
  };

  return (
    <div 
      className={cn(
        "liquid-glass-kpi p-5 group",
        className
      )}
    >
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-2.5 rounded-xl transition-all duration-200 group-hover:scale-105",
            getIconContainerClass()
          )}>
            {icon}
          </div>
          {change !== undefined && (
            <TrendBadge 
              value={trend === "down" ? -Math.abs(change) : change}
              size="sm"
              animated={false}
            />
          )}
        </div>

        {/* Value */}
        <div className="mb-2">
          {isNumericValue ? (
            <AnimatedValue
              value={value as number}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              className="text-2xl md:text-3xl tracking-tight"
              color={valueColor}
              format="currency"
              duration={1500}
            />
          ) : (
            <span className={cn(
              "text-2xl md:text-3xl font-bold tracking-tight",
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
            <span className="text-xs text-muted-foreground/70">{changeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
