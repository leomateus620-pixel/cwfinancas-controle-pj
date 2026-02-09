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
        "bg-card border border-border rounded-xl p-6",
        "shadow-corporate-sm",
        hover && "hover:shadow-corporate-md hover:-translate-y-0.5 transition-corporate",
        className
      )}
    >
      {children}
    </div>
  );
}
