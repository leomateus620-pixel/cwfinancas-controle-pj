import { motion, useReducedMotion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StationState = "pending" | "passing" | "current" | "upcoming";

interface Props {
  label: string;
  Icon: LucideIcon;
  state: StationState;
  orientation?: "horizontal" | "vertical";
  /** Leve rotação Y para sensação de túnel (apenas horizontal). */
  tilt?: number;
}

/**
 * Estação do túnel.
 * - pending: estado inicial neutro
 * - passing: puck cruzando agora → glow azul pulsante, SEM check, SEM verde
 * - upcoming: já revelada mas o puck não está nela → neutra com borda azul leve
 * - current: estação onde a demanda PAROU (só "Recebida") → verde + check
 */
export function FlowStationCard({
  label,
  Icon,
  state,
  orientation = "horizontal",
  tilt = 0,
}: Props) {
  const reduce = useReducedMotion();
  const isCurrent = state === "current";
  const isPassing = state === "passing";
  const isUpcoming = state === "upcoming";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: reduce ? 1 : isPassing ? 1.06 : isCurrent ? 1.02 : 1,
        z: reduce ? 0 : isPassing ? -6 : 0,
        rotateY: orientation === "horizontal" ? tilt : 0,
      }}
      transition={
        reduce
          ? undefined
          : isPassing
          ? { type: "spring", stiffness: 320, damping: 16 }
          : { duration: 0.32, ease: "easeOut" }
      }
      style={{ transformStyle: "preserve-3d" }}
      className={cn(
        "relative flex items-center justify-center rounded-xl border backdrop-blur-md transition-colors duration-300",
        orientation === "horizontal"
          ? "flex-col gap-1 px-2.5 py-2 min-w-[68px] md:min-w-[78px]"
          : "flex-row gap-2 px-3 py-2 w-full",
        isCurrent &&
          "bg-white/85 border-emerald-400/55 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.9)]",
        isPassing &&
          "bg-white/85 border-sky-400/70 shadow-[0_12px_28px_-10px_rgba(56,189,248,0.55),inset_0_1px_0_rgba(255,255,255,0.95)]",
        isUpcoming &&
          "bg-white/55 border-sky-300/35 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.75)]",
        state === "pending" &&
          "bg-white/45 border-white/60 shadow-[0_4px_10px_-6px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]",
      )}
    >
      {/* Glow overlay */}
      {(isPassing || isCurrent) && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl pointer-events-none",
            isPassing
              ? "bg-gradient-to-br from-sky-300/25 via-cyan-200/15 to-blue-400/15"
              : "bg-gradient-to-br from-emerald-400/15 to-blue-400/10",
          )}
        />
      )}

      {/* Halo passing */}
      {isPassing && !reduce && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.9, 1.25, 1.45] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: "0 0 24px 4px rgba(56,189,248,0.55)",
          }}
        />
      )}

      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-colors duration-300",
          orientation === "horizontal" ? "w-7 h-7" : "w-8 h-8",
          isCurrent && "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
          isPassing && "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
          (isUpcoming || state === "pending") && "bg-foreground/[0.06] text-foreground/55",
        )}
        style={
          isCurrent
            ? {
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 10px -3px rgba(16,185,129,0.45)",
              }
            : isPassing
            ? {
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px -3px rgba(56,189,248,0.55)",
              }
            : undefined
        }
      >
        {isCurrent ? (
          <Check className="w-4 h-4" strokeWidth={2.6} />
        ) : (
          <Icon className="w-4 h-4" strokeWidth={2.1} />
        )}
      </div>
      <span
        className={cn(
          "relative text-[10.5px] font-semibold tracking-tight whitespace-nowrap transition-colors duration-300",
          orientation === "vertical" && "text-[12px] font-medium",
          isCurrent && "text-foreground",
          isPassing && "text-sky-700",
          (isUpcoming || state === "pending") && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </motion.div>
  );
}
