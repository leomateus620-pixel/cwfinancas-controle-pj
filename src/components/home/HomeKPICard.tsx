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
  delay?: number;
}

export function HomeKPICard({ label, value, icon, tooltip, href, large, valueColor, trend, delay = 0 }: HomeKPICardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <GlassCard variant={large ? "highlight" : "default"} className={cn("p-5 md:p-6", large && "col-span-2")}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
            {icon}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-white/30 hover:text-white/60 transition-colors text-xs">ⓘ</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={cn(
          large ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl",
          "font-bold tabular-nums tracking-tight",
          valueColor || "text-white"
        )}>
          {value}
        </p>

        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              trend.value >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
            </span>
            <span className="text-white/30 text-xs">{trend.label}</span>
          </div>
        )}

        {href && (
          <button
            onClick={() => navigate(href)}
            className="mt-3 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors group"
          >
            Ver detalhes
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </GlassCard>
    </div>
  );
}
