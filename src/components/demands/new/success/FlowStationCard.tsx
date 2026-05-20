import { motion, useReducedMotion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StationState = "pending" | "passing" | "current" | "upcoming";

interface Props {
  label: string;
  Icon: LucideIcon;
  state: StationState;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

/**
 * Checkpoint discreto sobre o trilho 3D.
 * - pending: nó neutro pequeno (círculo translúcido sobre o trilho)
 * - passing: pulse spring + anel azul acende
 * - upcoming: já "passou", borda azul suave + check pequeno discreto
 * - current: NÃO é mais usado para nada verde berrante — só azul fica
 *
 * Não é um card quadrado. É um nó (dot) com label compacto.
 */
export function FlowStationCard({
  label,
  Icon,
  state,
  orientation = "horizontal",
}: Props) {
  const reduce = useReducedMotion();
  const isPassing = state === "passing";
  const isUpcoming = state === "upcoming" || state === "current";

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "relative flex items-center pointer-events-none",
        isVertical ? "flex-row gap-2.5 w-full" : "flex-col gap-1.5",
      )}
    >
      {/* Nó (dot) */}
      <motion.div
        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
        animate={{
          scale: reduce ? 1 : isPassing ? 1.18 : 1,
          opacity: 1,
        }}
        transition={
          reduce
            ? undefined
            : isPassing
            ? { type: "spring", stiffness: 320, damping: 14 }
            : { duration: 0.32, ease: "easeOut" }
        }
        className={cn(
          "relative flex items-center justify-center rounded-full backdrop-blur-md transition-colors duration-300 shrink-0",
          isVertical ? "w-8 h-8" : "w-7 h-7",
          isPassing
            ? "bg-gradient-to-br from-sky-400 to-blue-600 text-white border border-sky-200/80"
            : isUpcoming
            ? "bg-white/90 text-sky-700 border border-sky-400/55"
            : "bg-white/60 text-foreground/55 border border-white/70",
        )}
        style={
          isPassing
            ? {
                boxShadow:
                  "0 0 0 3px rgba(56,189,248,0.25), 0 6px 14px -3px rgba(56,189,248,0.55), inset 0 1px 0 rgba(255,255,255,0.55)",
              }
            : isUpcoming
            ? {
                boxShadow:
                  "0 2px 6px -2px rgba(56,189,248,0.30), inset 0 1px 0 rgba(255,255,255,0.85)",
              }
            : {
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
              }
        }
      >
        {isUpcoming && !isPassing ? (
          <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
        ) : (
          <Icon className={cn(isVertical ? "w-4 h-4" : "w-3.5 h-3.5")} strokeWidth={2.2} />
        )}

        {/* Halo de passagem */}
        {isPassing && !reduce && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.7, scale: 0.9 }}
            animate={{ opacity: 0, scale: 2.1 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "0 0 0 2px rgba(56,189,248,0.6)" }}
          />
        )}
      </motion.div>

      {/* Label */}
      <span
        className={cn(
          "font-semibold tracking-tight whitespace-nowrap transition-colors duration-300",
          isVertical ? "text-[12px]" : "text-[10px]",
          isPassing
            ? "text-sky-700"
            : isUpcoming
            ? "text-foreground/85"
            : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}
