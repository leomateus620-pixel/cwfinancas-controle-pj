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
  animated = true,
  className,
}: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const getTrendColor = () => {
    if (isPositive) return "text-success bg-success/10 border-success/20";
    if (isNegative) return "text-destructive bg-destructive/10 border-destructive/20";
    return "text-muted-foreground bg-muted border-border";
  };

  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-0.5 gap-1";
      case "lg":
        return "text-base px-4 py-1.5 gap-2";
      default:
        return "text-sm px-2.5 py-1 gap-1.5";
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
        "inline-flex items-center rounded-full font-semibold border transition-all duration-300",
        getTrendColor(),
        getSizeClass(),
        animated && isPositive && "animate-pulse-glow",
        className
      )}
    >
      {showIcon && (
        <TrendIcon
          className={cn(
            getIconSize(),
            animated && isPositive && "animate-trend-bounce"
          )}
        />
      )}
      <span>{isPositive ? "+" : ""}{Math.abs(value).toFixed(1)}%</span>
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </div>
  );
}
