import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CorporateCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function CorporateCard({ children, className, hover = true }: CorporateCardProps) {
  return (
    <div 
      className={cn(
        "liquid-glass-card p-6",
        !hover && "hover:transform-none",
        className
      )}
    >
      {children}
    </div>
  );
}
