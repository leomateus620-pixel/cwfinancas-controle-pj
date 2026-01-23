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
  valueColor?: "default" | "success" | "danger" | "primary";
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = "vs período anterior",
  icon,
  trend = "neutral",
  valueColor = "default",
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
        return <TrendingUp className="w-4 h-4" />;
      case "down":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getValueColor = () => {
    switch (valueColor) {
      case "success":
        return "text-success";
      case "danger":
        return "text-destructive";
      case "primary":
        return "text-primary";
      default:
        return "text-foreground";
    }
  };

  return (
    <div 
      className={cn(
        "group relative bg-card/95 backdrop-blur-md rounded-2xl p-6 border border-border",
        "shadow-corporate-md hover:shadow-corporate-lg transition-corporate",
        "animate-corporate-enter hover:-translate-y-0.5",
        className
      )}
    >
      <div className="relative">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg", getTrendColor(), 
              trend === "up" ? "bg-success/10" : trend === "down" ? "bg-destructive/10" : "bg-muted"
            )}>
              {getTrendIcon()}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>

        {/* Valor */}
        <div className="mb-2">
          <span className={cn("text-3xl md:text-4xl font-bold tracking-tight", getValueColor())}>
            {value}
          </span>
        </div>

        {/* Título e label de mudança */}
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
