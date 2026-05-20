import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Inbox, Search, Users } from "lucide-react";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { CWLogoDestination } from "./CWLogoDestination";
import { FlowStationCard, type StationState } from "./FlowStationCard";
import { cn } from "@/lib/utils";

interface Props {
  typeKey: string;
  typeLabel: string;
}

const STATIONS = [
  { id: "received", label: "Recebida", Icon: Inbox },
  { id: "analysis", label: "Em análise", Icon: Search },
  { id: "team", label: "Equipe CW", Icon: Users },
] as const;

/**
 * Timeline (ms):
 *  0      → puck inicia
 *  600    → cruza "Recebida"   (passing)
 *  1050   → cruza "Em análise" (passing)
 *  1500   → cruza "Equipe CW"  (passing)
 *  1900   → chega na logo CW
 *  2100   → estado final: só "Recebida" verde, outras voltam neutras
 */
const PASS_AT = [600, 1050, 1500];
const PASS_DURATION = 320;
const ARRIVED_AT = 1900;
const SETTLE_AT = 2100;

/**
 * Túnel 3D real: perspective + feixe de luz + partículas + puck com
 * translateZ/rotateY + trail. Só "Recebida" termina verde com check.
 */
export function DemandFlowSection({ typeKey, typeLabel }: Props) {
  const reduce = useReducedMotion();

  const [passingIdx, setPassingIdx] = useState<number | null>(null);
  const [arrived, setArrived] = useState<boolean>(!!reduce);
  const [settled, setSettled] = useState<boolean>(!!reduce);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    PASS_AT.forEach((ms, i) => {
      timers.push(window.setTimeout(() => setPassingIdx(i), ms));
      timers.push(window.setTimeout(() => {
        setPassingIdx((cur) => (cur === i ? null : cur));
      }, ms + PASS_DURATION));
    });
    timers.push(window.setTimeout(() => setArrived(true), ARRIVED_AT));
    timers.push(window.setTimeout(() => setSettled(true), SETTLE_AT));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const stationState = (i: number): StationState => {
    if (passingIdx === i) return "passing";
    if (settled && i === 0) return "current"; // só "Recebida" fica verde
    if (settled) return "upcoming";
    return "pending";
  };

  // Partículas estáveis
  const particles = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        id: i,
        delay: (i * 0.32) % 2.4,
        top: 30 + ((i * 53) % 40),
        size: 2 + (i % 3),
      })),
    [],
  );

  return (
    <div className="relative">
      {/* ============ DESKTOP / TABLET (md+) — túnel horizontal ============ */}
      <div
        className="hidden md:block relative py-2"
        style={{
          perspective: "1200px",
          perspectiveOrigin: "50% 55%",
        }}
      >
        {/* Atmosfera de fundo (neblina respirando) */}
        {!reduce && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0.35 }}
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background:
                "radial-gradient(ellipse at 50% 60%, rgba(56,189,248,0.10), transparent 65%)",
            }}
          />
        )}

        <div
          className="relative"
          style={{ transformStyle: "preserve-3d", transform: "rotateX(2deg)" }}
        >
          {/* Trilha de fundo */}
          <div className="absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent pointer-events-none" />
          <div className="absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 h-[6px] -mt-[3px] rounded-full bg-gradient-to-r from-transparent via-sky-400/12 to-transparent blur-md pointer-events-none" />

          {/* Feixe de luz percorrendo (camada principal de túnel) */}
          {!reduce && (
            <motion.div
              aria-hidden
              initial={{ left: "5%", opacity: 0 }}
              animate={{
                left: ["5%", "95%"],
                opacity: [0, 1, 1, 0.6],
                z: [-10, 12, -10],
              }}
              transition={{
                duration: 2.6,
                times: [0, 0.1, 0.85, 1],
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.4,
              }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-[140px] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(255,255,255,0.95), rgba(125,211,252,0.55) 40%, transparent 75%)",
                filter: "blur(6px)",
                mixBlendMode: "screen",
                transformStyle: "preserve-3d",
              }}
            />
          )}

          {/* Partículas de luz */}
          {!reduce &&
            particles.map((p) => (
              <motion.div
                key={p.id}
                aria-hidden
                initial={{ left: "5%", opacity: 0 }}
                animate={{
                  left: ["5%", "95%"],
                  opacity: [0, 0.9, 0],
                  z: [-15, 18, -15],
                  y: [0, -4, 2, 0],
                }}
                transition={{
                  duration: 2.4 + (p.id % 3) * 0.3,
                  delay: p.delay,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 0.2,
                }}
                className="absolute rounded-full bg-white pointer-events-none"
                style={{
                  top: `${p.top}%`,
                  width: p.size,
                  height: p.size,
                  filter: "blur(0.5px) drop-shadow(0 0 4px rgba(125,211,252,0.9))",
                  mixBlendMode: "screen",
                  transformStyle: "preserve-3d",
                }}
              />
            ))}

          {/* Grade de cards (paredes do túnel) */}
          <div className="relative grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-1.5 lg:gap-2">
            <OriginCard typeKey={typeKey} typeLabel={typeLabel} />
            <Connector />
            <FlowStationCard
              label={STATIONS[0].label}
              Icon={STATIONS[0].Icon}
              state={stationState(0)}
              tilt={4}
            />
            <Connector />
            <FlowStationCard
              label={STATIONS[1].label}
              Icon={STATIONS[1].Icon}
              state={stationState(1)}
              tilt={0}
            />
            <Connector />
            <FlowStationCard
              label={STATIONS[2].label}
              Icon={STATIONS[2].Icon}
              state={stationState(2)}
              tilt={-4}
            />
            <Connector />
            <div className="flex items-center justify-center">
              <CWLogoDestination arrived={arrived} size="md" />
            </div>
          </div>

          {/* Puck — token da demanda atravessando com profundidade real */}
          {!reduce && (
            <>
              {/* Trail (rastros) */}
              {[160, 80].map((delay, i) => (
                <motion.div
                  key={`trail-${delay}`}
                  initial={{ left: "4%", opacity: 0 }}
                  animate={{
                    left: ["4%", "26%", "48%", "70%", "92%"],
                    opacity: [0, 0.28 - i * 0.08, 0.22 - i * 0.06, 0.15, 0],
                    scale: [1, 0.92, 0.88, 0.82, 0.5],
                  }}
                  transition={{
                    duration: 1.9,
                    delay: 0.45 + delay / 1000,
                    times: [0, 0.25, 0.5, 0.75, 1],
                    ease: [0.45, 0.05, 0.3, 1],
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-[9]"
                >
                  <div
                    className="rounded-xl bg-sky-300/40 backdrop-blur-md px-2 py-1.5 flex items-center gap-1.5 border border-sky-300/30"
                    style={{ filter: "blur(2px)" }}
                  >
                    <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
                  </div>
                </motion.div>
              ))}

              {/* Halo glow do puck */}
              <motion.div
                initial={{ left: "4%", opacity: 0, scale: 0.8 }}
                animate={{
                  left: ["4%", "26%", "48%", "70%", "92%"],
                  opacity: [0, 0.9, 1, 0.9, 0],
                  scale: [0.8, 1.4, 1.5, 1.3, 0.6],
                }}
                transition={{
                  duration: 1.9,
                  delay: 0.45,
                  times: [0, 0.25, 0.5, 0.75, 1],
                  ease: "easeInOut",
                }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-16 h-16 rounded-full pointer-events-none z-[9]"
                style={{
                  background:
                    "radial-gradient(circle, rgba(125,211,252,0.55), rgba(59,130,246,0.25) 40%, transparent 70%)",
                  filter: "blur(8px)",
                  mixBlendMode: "screen",
                }}
              />

              {/* Puck principal */}
              <motion.div
                initial={{ left: "4%", scale: 1, opacity: 0, z: 40, rotateY: 0 }}
                animate={{
                  left: ["4%", "26%", "48%", "70%", "92%"],
                  scale: [1, 0.98, 0.95, 0.9, 0.55],
                  opacity: [0, 1, 1, 1, 0],
                  rotateY: [0, 12, -8, 10, 0],
                  y: [0, -4, 3, -3, 0],
                  z: [40, 0, 10, 0, 40],
                }}
                transition={{
                  duration: 1.9,
                  delay: 0.45,
                  times: [0, 0.25, 0.5, 0.75, 1],
                  type: "spring",
                  stiffness: 55,
                  damping: 16,
                  mass: 0.9,
                }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="rounded-xl bg-white/95 backdrop-blur-xl border border-sky-200/80 px-2 py-1.5 flex items-center gap-1.5"
                  style={{
                    boxShadow:
                      "0 16px 36px -12px rgba(56,189,248,0.55), 0 0 18px rgba(125,211,252,0.45), inset 0 1px 0 rgba(255,255,255,0.95)",
                  }}
                >
                  <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* ============ MOBILE (<md) — túnel vertical compacto ============ */}
      <div className="md:hidden relative flex flex-col items-stretch gap-2 py-1">
        {/* Feixe vertical */}
        {!reduce && (
          <motion.div
            aria-hidden
            initial={{ top: "5%", opacity: 0 }}
            animate={{ top: ["5%", "95%"], opacity: [0, 1, 1, 0.5] }}
            transition={{
              duration: 2.6,
              times: [0, 0.1, 0.85, 1],
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 0.4,
            }}
            className="absolute left-1/2 -translate-x-1/2 h-[80px] w-2 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.9), rgba(125,211,252,0.5) 40%, transparent 75%)",
              filter: "blur(6px)",
              mixBlendMode: "screen",
            }}
          />
        )}

        <OriginCard typeKey={typeKey} typeLabel={typeLabel} mobile />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[0].label}
          Icon={STATIONS[0].Icon}
          state={stationState(0)}
          orientation="vertical"
        />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[1].label}
          Icon={STATIONS[1].Icon}
          state={stationState(1)}
          orientation="vertical"
        />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[2].label}
          Icon={STATIONS[2].Icon}
          state={stationState(2)}
          orientation="vertical"
        />
        <VerticalConnector />
        <div className="flex justify-center pt-1">
          <CWLogoDestination arrived={arrived} size="md" />
        </div>
      </div>

      {/* Confirmação textual */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: arrived ? 1 : 0, y: arrived ? 0 : 4 }}
        transition={reduce ? undefined : { duration: 0.32, ease: "easeOut" }}
        className="text-center mt-3 md:mt-4 text-[11.5px] font-medium tracking-wide text-emerald-700"
      >
        Encaminhada para análise da equipe CW
      </motion.div>
    </div>
  );
}

function OriginCard({
  typeKey,
  typeLabel,
  mobile,
}: {
  typeKey: string;
  typeLabel: string;
  mobile?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-2 rounded-xl bg-white/85 border border-white/70 backdrop-blur-xl z-[2]",
        mobile ? "px-3 py-2 w-full justify-center" : "px-2.5 py-2",
      )}
      style={{
        boxShadow:
          "0 8px 22px -10px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
        transform: mobile ? undefined : "rotateY(6deg)",
        transformStyle: "preserve-3d",
      }}
    >
      <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          Sua demanda
        </span>
        <span className="text-[11.5px] font-semibold text-foreground truncate">
          {typeLabel}
        </span>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="relative h-px self-center">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
    </div>
  );
}

function VerticalConnector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-3 bg-gradient-to-b from-transparent via-sky-400/30 to-transparent" />
    </div>
  );
}
