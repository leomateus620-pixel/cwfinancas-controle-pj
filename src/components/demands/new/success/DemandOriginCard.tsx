import { motion, useReducedMotion } from "framer-motion";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { cn } from "@/lib/utils";

interface Props {
  typeKey: string;
  typeLabel: string;
  code: string;
  priority?: "alta" | "media" | "baixa" | string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  alta: "bg-rose-500/12 text-rose-700 border-rose-500/30",
  media: "bg-amber-500/12 text-amber-700 border-amber-500/30",
  baixa: "bg-sky-500/12 text-sky-700 border-sky-500/30",
};

/**
 * Mini card 3D que representa a demanda como objeto físico de origem.
 * Premium, com leve rotação Y em repouso (desktop) e sombra dupla.
 */
export function DemandOriginCard({
  typeKey,
  typeLabel,
  code,
  priority,
  orientation = "horizontal",
  className,
}: Props) {
  const reduce = useReducedMotion();
  const isVertical = orientation === "vertical";
  const priorityClass = priority ? PRIORITY_STYLES[priority] : undefined;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: isVertical ? 0 : -14, y: isVertical ? -8 : 0, rotateY: isVertical ? 0 : 14 }}
      animate={{ opacity: 1, x: 0, y: 0, rotateY: isVertical ? 0 : 8 }}
      transition={reduce ? undefined : { type: "spring", stiffness: 180, damping: 22, delay: 0.15 }}
      style={{ transformStyle: "preserve-3d", transformOrigin: "center" }}
      className={cn(
        "relative inline-flex flex-col rounded-2xl bg-white/85 backdrop-blur-xl border border-white/75 z-[3]",
        isVertical ? "w-full max-w-[240px] px-3.5 py-2.5" : "px-3 py-2.5 min-w-[124px]",
        className,
      )}
    >
      {/* Sombra dupla via inline (translúcida + projetada) */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow:
            "0 14px 30px -10px rgba(15,23,42,0.22), 0 0 0 1px rgba(255,255,255,0.6) inset, inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      />

      {/* Header: label + badge prioridade */}
      <div className="relative flex items-center justify-between gap-2 mb-1">
        <span className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Sua demanda
        </span>
        {priorityClass && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-wide",
              priorityClass,
            )}
          >
            {priority}
          </span>
        )}
      </div>

      {/* Conteúdo: ícone + tipo + código */}
      <div className="relative flex items-center gap-2">
        <div
          className="shrink-0 rounded-xl bg-gradient-to-br from-white to-white/70 border border-white/60 flex items-center justify-center w-9 h-9"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 10px -3px rgba(15,23,42,0.15)",
          }}
        >
          <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[12.5px] font-semibold text-foreground truncate">
            {typeLabel}
          </span>
          <span className="text-[10.5px] font-mono tabular-nums text-muted-foreground truncate">
            {code}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
