import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/home/GlassCard";
import { DemandTypeIcon, type DemandIconKey } from "./DemandTypeIcon";

interface Props {
  icon: DemandIconKey;
  label: string;
  value: string;
  sub?: ReactNode;
  trend?: { positive?: boolean; text: string };
  to?: string;
  mono?: boolean;
  className?: string;
}

export function MetricTile({ icon, label, value, sub, trend, to, mono, className }: Props) {
  const inner = (
    <GlassCard
      className={cn(
        "p-4 md:p-5 h-full flex flex-col gap-3 group transition-all duration-300",
        to && "cursor-pointer hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium leading-tight">
          {label}
        </span>
        <DemandTypeIcon kind={icon} size="sm" />
      </div>
      <div
        className={cn(
          "text-2xl md:text-[28px] font-semibold tracking-tight leading-none",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </div>
      {(sub || trend) && (
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="text-[11px] text-muted-foreground line-clamp-1">{sub}</div>
          {trend && (
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono leading-none ring-1",
                trend.positive
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 ring-rose-500/20",
              )}
            >
              {trend.text}
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl">
        {inner}
      </Link>
    );
  }
  return inner;
}
