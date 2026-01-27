import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
  color?: "default" | "primary" | "success" | "danger";
  glow?: boolean;
  format?: "currency" | "percent" | "number";
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedValue({
  value,
  prefix = "",
  suffix = "",
  duration = 1500,
  decimals = 0,
  className,
  color = "default",
  glow = false,
  format = "number",
}: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    setIsAnimating(true);
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      
      setDisplayValue(easedProgress * value);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formatValue = (val: number): string => {
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
      case "percent":
        return val.toFixed(decimals);
      default:
        return new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val);
    }
  };

  const getColorClass = () => {
    switch (color) {
      case "primary":
        return "text-primary";
      case "success":
        return "text-success";
      case "danger":
        return "text-destructive";
      default:
        return "text-foreground";
    }
  };

  const getGlowClass = () => {
    if (!glow || isAnimating) return "";
    switch (color) {
      case "primary":
        return "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]";
      case "success":
        return "drop-shadow-[0_0_8px_hsl(var(--success)/0.5)]";
      case "danger":
        return "drop-shadow-[0_0_8px_hsl(var(--destructive)/0.5)]";
      default:
        return "";
    }
  };

  return (
    <span
      className={cn(
        "tabular-nums font-bold transition-all duration-300",
        getColorClass(),
        getGlowClass(),
        !isAnimating && "animate-count-emphasis",
        className
      )}
    >
      {prefix}
      {formatValue(displayValue)}
      {suffix}
    </span>
  );
}
