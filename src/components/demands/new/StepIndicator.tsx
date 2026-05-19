import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Props {
  steps: readonly string[];
  current: number;
  onStepClick?: (i: number) => void;
}

export function StepIndicator({ steps, current, onStepClick }: Props) {
  return (
    <div className="flex items-center gap-2 w-full">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= current;
        return (
          <div key={label} className="flex-1 flex items-center gap-2 min-w-0">
            <button
              type="button"
              disabled={!reachable || !onStepClick}
              onClick={() => onStepClick?.(i)}
              className={cn(
                "relative h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-300",
                done && "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]",
                active && "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_6px_18px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.5)] ring-2 ring-blue-300/40",
                !done && !active && "bg-white/60 text-muted-foreground border border-black/[0.06] backdrop-blur-md",
                onStepClick && reachable && "hover:scale-105",
              )}
              aria-label={`Etapa ${i + 1}: ${label}`}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span
              className={cn(
                "text-xs hidden md:inline truncate transition-colors",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-[2px] rounded-full overflow-hidden bg-black/[0.06]">
                <div
                  className={cn(
                    "h-full transition-all duration-500 ease-out",
                    done ? "w-full bg-gradient-to-r from-emerald-400 to-emerald-500" : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
