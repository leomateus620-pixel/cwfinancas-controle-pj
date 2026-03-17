import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface HomeKPICardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tooltip: string;
  href?: string;
  large?: boolean;
  valueColor?: string;
  trend?: { value: number; label: string } | null;
  subtitle?: string;
  delay?: number;
}

export function HomeKPICard({ label, value, icon, tooltip, href, large, valueColor, trend, subtitle, delay = 0 }: HomeKPICardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard variant={large ? "highlight" : "default"} className={cn("p-5 md:p-6", large && "col-span-2")}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            {icon}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={cn(
          large ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
          "font-bold tabular-nums tracking-tight",
          valueColor || "text-foreground"
        )}>
          {value}
        </p>

        {subtitle && (
          <p className="text-muted-foreground/60 text-[11px] mt-0.5">{subtitle}</p>
        )}

        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              trend.value >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
            </span>
            <span className="text-muted-foreground/60 text-xs">{trend.label}</span>
          </div>
        )}

        {href && (
          <button
            onClick={() => navigate(href)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors group"
          >
            Ver detalhes
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </GlassCard>
    </div>
  );
}
