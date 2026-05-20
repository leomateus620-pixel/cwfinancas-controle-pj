import { motion, useReducedMotion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  orientation?: "horizontal" | "vertical";
}

/**
 * Estação intermediária do fluxo. Reage com pulse + glow + check
 * quando a demanda passa por ela.
 */
export function FlowStationCard({ label, Icon, active, orientation = "horizontal" }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={
        reduce
          ? undefined
          : active
          ? { opacity: 1, y: 0, scale: [1, 1.07, 1] }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={
        reduce
          ? undefined
          : active
          ? { type: "spring", stiffness: 260, damping: 18 }
          : { duration: 0.3, ease: "easeOut" }
      }
      className={cn(
        "relative flex items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-300",
        orientation === "horizontal"
          ? "flex-col gap-1 px-2.5 py-2 min-w-[68px] md:min-w-[78px]"
          : "flex-row gap-2 px-3 py-2 w-full",
        active
          ? "bg-white/85 border-emerald-400/50 shadow-[0_8px_22px_-10px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "bg-white/55 border-white/60 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.7)]",
      )}
    >
      {/* Glow ativo */}
      {active && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/15 to-blue-400/10 pointer-events-none" />
      )}

      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-colors duration-300",
          orientation === "horizontal" ? "w-7 h-7" : "w-8 h-8",
          active
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
            : "bg-foreground/[0.06] text-foreground/55",
        )}
        style={
          active
            ? {
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 10px -3px rgba(16,185,129,0.45)",
              }
            : undefined
        }
      >
        {active ? <Check className="w-4 h-4" strokeWidth={2.6} /> : <Icon className="w-4 h-4" strokeWidth={2.1} />}
      </div>
      <span
        className={cn(
          "relative text-[10.5px] font-semibold tracking-tight whitespace-nowrap transition-colors duration-300",
          orientation === "vertical" && "text-[12px] font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </motion.div>
  );
}
