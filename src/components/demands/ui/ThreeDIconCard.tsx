import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DemandTypeIcon, type DemandIconKey } from "./DemandTypeIcon";

interface Props {
  icon: DemandIconKey;
  title: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function ThreeDIconCard({ icon, title, description, selected, onClick, className, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-4 rounded-2xl border transition-all duration-200 ease-out",
        "bg-white/55 backdrop-blur-xl",
        "border-black/[0.06]",
        "shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]",
        "hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)]",
        selected && "border-primary/60 ring-2 ring-primary/25 bg-primary/[0.04] shadow-[0_8px_22px_-6px_rgba(59,130,246,0.35),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <DemandTypeIcon kind={icon} size="md" />
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-semibold leading-tight", selected && "text-primary")}>{title}</div>
          {description && <div className="text-[11.5px] text-muted-foreground mt-1 leading-snug">{description}</div>}
          {children}
        </div>
      </div>
    </button>
  );
}
