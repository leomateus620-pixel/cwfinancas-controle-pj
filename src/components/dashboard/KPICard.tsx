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
        "group relative bg-card rounded-xl p-5 border border-border",
        "shadow-corporate-sm hover:shadow-corporate-md transition-corporate",
        "hover:-translate-y-0.5",
        className
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
        valueColor === "primary" && "bg-gradient-to-br from-primary/3 via-transparent to-transparent",
        valueColor === "success" && "bg-gradient-to-br from-success/3 via-transparent to-transparent",
        valueColor === "danger" && "bg-gradient-to-br from-destructive/3 via-transparent to-transparent"
      )} />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-2.5 rounded-lg transition-all duration-200 group-hover:scale-105",
            valueColor === "primary" && "bg-primary/10 text-primary",
            valueColor === "success" && "bg-success/10 text-success",
            valueColor === "danger" && "bg-destructive/10 text-destructive",
            valueColor === "default" && "bg-muted text-muted-foreground"
          )}>
            {icon}
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
          <span className="text-sm text-muted-foreground">{title}</span>
          {changeLabel && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
