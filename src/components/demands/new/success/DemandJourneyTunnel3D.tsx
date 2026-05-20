import { motion, useReducedMotion } from "framer-motion";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { CWLogoDestination } from "./CWLogoDestination";
import { useEffect, useState } from "react";

interface Props {
  typeKey: string;
}

/**
 * Túnel 3D que leva a demanda até a logo CW.
 * - Desktop: horizontal. Mobile: vertical.
 * - Respeita prefers-reduced-motion.
 */
export function DemandJourneyTunnel3D({ typeKey }: Props) {
  const reduce = useReducedMotion();
  const [arrived, setArrived] = useState(reduce ?? false);

  useEffect(() => {
    if (reduce) {
      setArrived(true);
      return;
    }
    const t = window.setTimeout(() => setArrived(true), 1500);
    return () => window.clearTimeout(t);
  }, [reduce]);

  const ringsDesktop = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div
      className="relative w-full max-w-3xl mx-auto"
      style={{ perspective: "1100px", perspectiveOrigin: "50% 50%" }}
    >
      {/* Layout horizontal (md+) */}
      <div className="hidden md:flex items-center justify-between h-56 relative">
        {/* Túnel - anéis em profundidade */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transformStyle: "preserve-3d" }}
        >
          {ringsDesktop.map((i) => {
            const tz = -i * 70;
            const opacity = 0.08 + (ringsDesktop.length - i) * 0.05;
            return (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity, scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.2 + i * 0.04, duration: 0.4, ease: "easeOut" }}
                className="absolute h-40 w-72 rounded-[40%/55%] border border-blue-400/40"
                style={{
                  transform: `translateZ(${tz}px)`,
                  boxShadow: "inset 0 0 30px rgba(59,130,246,0.12)",
                }}
              />
            );
          })}
        </div>

        {/* Orbs de glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 h-32 w-32 rounded-full bg-blue-400/30 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 h-32 w-32 rounded-full bg-emerald-400/25 blur-3xl" />
        </div>

        {/* Ponto inicial (origem da demanda) */}
        <div className="relative z-10 ml-2">
          <motion.div
            initial={reduce ? false : { x: 0, scale: 1, opacity: 1 }}
            animate={reduce ? undefined : arrived ? { x: 320, scale: 0.4, opacity: 0 } : { x: 0, scale: 1, opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-white/85 backdrop-blur-xl border border-white/70 px-3 py-2 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.25)] flex items-center gap-2"
          >
            <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
              Sua demanda
            </div>
          </motion.div>
        </div>

        {/* Logo destino */}
        <div className="relative z-10 mr-2">
          <CWLogoDestination arrived={arrived} />
        </div>
      </div>

      {/* Layout vertical (mobile) */}
      <div className="md:hidden flex flex-col items-center justify-between gap-2 h-72 relative">
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transformStyle: "preserve-3d" }}
        >
          {[0, 1, 2, 3].map((i) => {
            const tz = -i * 50;
            const opacity = 0.1 + (4 - i) * 0.06;
            return (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity, scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.15 + i * 0.05, duration: 0.35 }}
                className="absolute h-56 w-44 rounded-[50%/40%] border border-blue-400/40"
                style={{ transform: `translateZ(${tz}px)` }}
              />
            );
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-blue-400/30 blur-3xl" />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-emerald-400/25 blur-3xl" />
        </div>

        <motion.div
          initial={reduce ? false : { y: 0, scale: 1, opacity: 1 }}
          animate={reduce ? undefined : arrived ? { y: 180, scale: 0.4, opacity: 0 } : { y: 0, scale: 1, opacity: 1 }}
          transition={reduce ? undefined : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/70 px-3 py-2 shadow-[0_14px_30px_-12px_rgba(15,23,42,0.25)] flex items-center gap-2"
        >
          <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
            Sua demanda
          </div>
        </motion.div>

        <div className="relative z-10">
          <CWLogoDestination arrived={arrived} />
        </div>
      </div>
    </div>
  );
}
