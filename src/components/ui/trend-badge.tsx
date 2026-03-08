import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendBadgeProps {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  animated?: boolean;
  className?: string;
}

export function TrendBadge({
  value,
  label,
  size = "md",
  showIcon = true,
  animated = false,
  className,
}: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const getTrendColor = () => {
    if (isPositive) return "bg-success/8 text-success border-success/15";
    if (isNegative) return "bg-destructive/8 text-destructive border-destructive/15";
    return "bg-muted/50 text-muted-foreground border-border/40";
  };

  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2.5 py-0.5 gap-1";
      case "lg":
        return "text-base px-4 py-1.5 gap-2";
      default:
        return "text-sm px-3 py-1 gap-1.5";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return "w-3 h-3";
      case "lg":
        return "w-5 h-5";
      default:
        return "w-4 h-4";
    }
  };

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "inline-flex items-center font-semibold border transition-all duration-200 glass-pill-badge",
        getTrendColor(),
        getSizeClass(),
        className
      )}
    >
      {showIcon && (
        <TrendIcon className={getIconSize()} />
      )}
      <span>{isPositive ? "+" : ""}{Math.abs(value).toFixed(1)}%</span>
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </div>
  );
}
