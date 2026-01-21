import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon,
  trend = "neutral",
  className,
}: KPICardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-success";
      case "down":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-3 h-3" />;
      case "down":
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  return (
    <div 
      className={cn(
        "group relative bg-card rounded-2xl p-6 border border-border/50",
        "shadow-premium-sm hover:shadow-premium-md transition-premium",
        "animate-fade-in",
        className
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-premium pointer-events-none" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-secondary/80">
            {icon}
          </div>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <span className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
        </div>

        {/* Title and change label */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
          {change !== undefined && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
