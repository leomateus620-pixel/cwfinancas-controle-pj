import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight" | "compact";
  hover?: boolean;
}

export function GlassCard({ children, className, variant = "default", hover = true }: GlassCardProps) {
  const variantClass = variant === "highlight"
    ? "liquid-glass-highlight"
    : variant === "compact"
    ? "liquid-glass-compact"
    : "liquid-glass";

  return (
    <div
      className={cn(
        variantClass,
        !hover && "hover:transform-none hover:shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}
