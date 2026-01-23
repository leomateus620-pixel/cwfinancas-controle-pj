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
        "bg-card/95 backdrop-blur-md border border-border rounded-2xl p-6",
        "shadow-corporate-md animate-corporate-enter",
        hover && "hover:shadow-corporate-lg hover:-translate-y-0.5 transition-corporate",
        className
      )}
    >
      {children}
    </div>
  );
}
