import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Inbox, Filter, Users } from "lucide-react";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { CWLogoDestination } from "./CWLogoDestination";
import { FlowStationCard, type StationState } from "./FlowStationCard";
import { DemandOriginCard } from "./DemandOriginCard";

interface Props {
  typeKey: string;
  typeLabel: string;
  code: string;
  priority?: string;
}

const STATIONS = [
  { id: "received", label: "Recebida", Icon: Inbox },
  { id: "triage", label: "Triagem", Icon: Filter },
  { id: "team", label: "Equipe CW", Icon: Users },
] as const;

// Timeline (ms)
const PASS_AT = [950, 1300, 1650];
const PASS_DURATION = 360;
const ARRIVED_AT = 2000;
const SETTLE_AT = 2200;

/**
 * Fluxo CW Premium — canal 3D real (não stepper).
 * Mini card → trilha em perspectiva com pontos de luz → núcleo CW.
 * Paleta azul nos checkpoints (sem verde berrante).
 */
export function DemandFlowSection({ typeKey, typeLabel, code, priority }: Props) {
  const reduce = useReducedMotion();

  const [passingIdx, setPassingIdx] = useState<number | null>(null);
  const [arrived, setArrived] = useState<boolean>(!!reduce);
  const [settled, setSettled] = useState<boolean>(!!reduce);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    PASS_AT.forEach((ms, i) => {
      timers.push(window.setTimeout(() => setPassingIdx(i), ms));
      timers.push(
        window.setTimeout(() => {
          setPassingIdx((cur) => (cur === i ? null : cur));
        }, ms + PASS_DURATION),
      );
    });
    timers.push(window.setTimeout(() => setArrived(true), ARRIVED_AT));
    timers.push(window.setTimeout(() => setSettled(true), SETTLE_AT));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const stationState = (i: number): StationState => {
    if (passingIdx === i) return "passing";
    if (settled || arrived) {
      // Após chegada, todos os checkpoints permanecem "upcoming" (azul suave + check)
      if (PASS_AT[i] <= (settled ? SETTLE_AT : ARRIVED_AT)) return "upcoming";
    }
    return "pending";
  };

  // Sparks (pontos de luz) viajando no trilho — loop infinito
  const sparks = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        id: i,
        delay: (i * 0.5) % 2.5,
        duration: 2.4 + (i % 3) * 0.25,
        offset: ((i * 17) % 30) - 15, // -15..15 px no eixo Y do trilho
        size: 2 + (i % 2),
      })),
    [],
  );

  return (
    <div className="relative">
      {/* ============ DESKTOP / TABLET (md+) — canal 3D horizontal premium ============ */}
      <div
        className="hidden md:block relative"
        style={{ perspective: "1600px", perspectiveOrigin: "50% 75%" }}
      >
        <div
          className="relative h-[240px] grid items-center gap-6"
          style={{
            gridTemplateColumns: "280px 1fr 220px",
            transformStyle: "preserve-3d",
          }}
        >
          {/* ───────── ZONA 1: ORIGEM com pedestal ───────── */}
          <div className="relative flex items-center justify-center h-full">
            {/* Pedestal radial */}
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[240px] h-5 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(15,23,42,0.22), transparent 70%)",
                filter: "blur(6px)",
              }}
            />
            <div className="relative" style={{ transformStyle: "preserve-3d" }}>
              <DemandOriginCard
                typeKey={typeKey}
                typeLabel={typeLabel}
                code={code}
                priority={priority}
              />
            </div>
          </div>

          {/* ───────── ZONA 2: CANAL 3D + CHECKPOINTS + PUCK ───────── */}
          <div
            className="relative h-full"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Piso inclinado (canal real) */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[140px] rounded-[32px] pointer-events-none"
              style={{
                transform: "rotateX(28deg) translateZ(-8px)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(241,245,249,0.25) 35%, rgba(226,232,240,0.10) 70%, rgba(15,23,42,0.05) 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -10px 24px rgba(15,23,42,0.10), 0 24px 48px -20px rgba(15,23,42,0.22)",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            />

            {/* Atmosfera azul respirando */}
            {!reduce && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0.35 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-x-[4%] top-1/2 -translate-y-1/2 h-[90px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.22), rgba(99,102,241,0.08) 50%, transparent 80%)",
                  filter: "blur(16px)",
                }}
              />
            )}

            {/* Trilho SVG alinhado aos centros dos checkpoints */}
            <svg
              aria-hidden
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(125,211,252,0)" />
                  <stop offset="12%" stopColor="rgba(125,211,252,0.75)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="88%" stopColor="rgba(110,231,183,0.75)" />
                  <stop offset="100%" stopColor="rgba(110,231,183,0)" />
                </linearGradient>
                <filter id="railGlow" x="-20%" y="-200%" width="140%" height="500%">
                  <feGaussianBlur stdDeviation="1.2" />
                </filter>
              </defs>
              {/* Guides finas */}
              <line x1="2" y1="42" x2="98" y2="42" stroke="rgba(125,211,252,0.30)" strokeWidth="0.18" />
              <line x1="2" y1="58" x2="98" y2="58" stroke="rgba(125,211,252,0.30)" strokeWidth="0.18" />
              {/* Trilho principal */}
              <line
                x1="2" y1="50" x2="98" y2="50"
                stroke="url(#railGrad)" strokeWidth="0.55"
                strokeLinecap="round" filter="url(#railGlow)"
              />
              <line
                x1="2" y1="50" x2="98" y2="50"
                stroke="url(#railGrad)" strokeWidth="0.28"
                strokeLinecap="round"
              />
            </svg>

            {/* Sparks viajando (nítidos, sem mix-blend) */}
            {!reduce &&
              sparks.map((p) => (
                <motion.div
                  key={p.id}
                  aria-hidden
                  initial={{ left: "2%", opacity: 0 }}
                  animate={{ left: ["2%", "98%"], opacity: [0, 1, 0] }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 0.3,
                  }}
                  className="absolute rounded-full bg-white pointer-events-none"
                  style={{
                    top: `calc(50% + ${p.offset * 0.5}px)`,
                    width: p.size + 1,
                    height: p.size + 1,
                    boxShadow:
                      "0 0 6px 1px rgba(125,211,252,0.95), 0 0 12px rgba(125,211,252,0.55)",
                    willChange: "left, opacity",
                  }}
                />
              ))}

            {/* Checkpoints alinhados ao trilho */}
            <div className="absolute inset-0 flex items-center justify-evenly px-[6%]">
              {STATIONS.map((st, i) => (
                <div key={st.id} className="relative flex flex-col items-center gap-2">
                  {/* Sombra elíptica projetada no piso */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-10 h-2 rounded-full pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, rgba(15,23,42,0.25), transparent 70%)",
                      filter: "blur(3px)",
                    }}
                  />
                  <FlowStationCard
                    label={st.label}
                    Icon={st.Icon}
                    state={stationState(i)}
                    size="lg"
                  />
                </div>
              ))}
            </div>

            {/* Puck + halo dentro do canal (8% → 92%) */}
            {!reduce && (
              <>
                <motion.div
                  initial={{ left: "8%", opacity: 0, scale: 0.7 }}
                  animate={{
                    left: ["8%", "30%", "50%", "70%", "92%"],
                    opacity: [0, 0.85, 1, 0.85, 0],
                    scale: [0.7, 1.4, 1.65, 1.4, 0.5],
                  }}
                  transition={{
                    duration: 1.6, delay: 0.7,
                    times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut",
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-20 h-20 rounded-full pointer-events-none z-[6]"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(125,211,252,0.55), rgba(59,130,246,0.22) 40%, transparent 70%)",
                    filter: "blur(10px)",
                    mixBlendMode: "screen",
                    willChange: "left, opacity, transform",
                  }}
                />
                <motion.div
                  initial={{ left: "8%", scale: 1, opacity: 0, rotateX: 12, y: 0 }}
                  animate={{
                    left: ["8%", "30%", "50%", "70%", "92%"],
                    scale: [1.1, 1.05, 1, 0.92, 0.6],
                    opacity: [0, 1, 1, 1, 0],
                    rotateX: [12, 14, 12, 14, 12],
                    y: [0, -3, 2, -2, 0],
                  }}
                  transition={{
                    duration: 1.6, delay: 0.7,
                    times: [0, 0.25, 0.5, 0.75, 1],
                    type: "spring", stiffness: 60, damping: 18, mass: 0.9,
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-[7]"
                  style={{ transformStyle: "preserve-3d", willChange: "left, transform" }}
                >
                  <div
                    className="rounded-xl bg-white/95 border border-sky-200/80 px-2.5 py-2 flex items-center gap-1.5"
                    style={{
                      boxShadow:
                        "0 18px 40px -12px rgba(56,189,248,0.6), 0 0 22px rgba(125,211,252,0.5), inset 0 1px 0 rgba(255,255,255,0.95)",
                    }}
                  >
                    <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* ───────── ZONA 3: NÚCLEO CW com pedestal ───────── */}
          <div className="relative flex items-center justify-center h-full">
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[180px] h-5 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(15,23,42,0.28), transparent 70%)",
                filter: "blur(6px)",
              }}
            />
            <div style={{ transformStyle: "preserve-3d" }}>
              <CWLogoDestination arrived={arrived} size="lg" showLabel />
            </div>
          </div>
        </div>
      </div>


      {/* ============ MOBILE (<md) — canal vertical compacto ============ */}
      <div className="md:hidden relative flex flex-col items-stretch gap-3 py-1 px-1">
        {/* Origem */}
        <div className="flex justify-center">
          <DemandOriginCard
            typeKey={typeKey}
            typeLabel={typeLabel}
            code={code}
            priority={priority}
            orientation="vertical"
          />
        </div>

        {/* Trilho vertical com checkpoints */}
        <div className="relative pl-5">
          {/* Linha vertical com gradiente */}
          <div
            aria-hidden
            className="absolute left-[18px] top-1 bottom-1 w-[2px] rounded-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(125,211,252,0) 0%, rgba(125,211,252,0.7) 20%, rgba(255,255,255,0.85) 50%, rgba(110,231,183,0.65) 85%, rgba(110,231,183,0) 100%)",
              boxShadow: "0 0 8px rgba(125,211,252,0.55)",
            }}
          />

          {/* Sparks descendo */}
          {!reduce &&
            sparks.slice(0, 3).map((p) => (
              <motion.div
                key={p.id}
                aria-hidden
                initial={{ top: "0%", opacity: 0 }}
                animate={{
                  top: ["0%", "100%"],
                  opacity: [0, 0.95, 0],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 0.3,
                }}
                className="absolute rounded-full bg-white pointer-events-none"
                style={{
                  left: 18,
                  width: p.size,
                  height: p.size,
                  filter: "blur(0.5px) drop-shadow(0 0 5px rgba(125,211,252,0.95))",
                  mixBlendMode: "screen",
                  transform: "translateX(-50%)",
                }}
              />
            ))}

          {/* Checkpoints */}
          <div className="relative flex flex-col gap-3">
            {STATIONS.map((st, i) => (
              <div key={st.id} className="relative pl-3">
                {/* Conector horizontal pequeno */}
                <div
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-sky-300/40"
                />
                <FlowStationCard
                  label={st.label}
                  Icon={st.Icon}
                  state={stationState(i)}
                  orientation="vertical"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Núcleo CW */}
        <div className="flex justify-center pt-2">
          <CWLogoDestination arrived={arrived} size="md" showLabel />
        </div>
      </div>

      {/* Confirmação textual */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: arrived ? 1 : 0, y: arrived ? 0 : 6 }}
        transition={reduce ? undefined : { duration: 0.4, ease: "easeOut" }}
        className="text-center mt-4 text-[12px] font-semibold tracking-wide text-emerald-700"
      >
        Encaminhada para análise da equipe CW
      </motion.div>
    </div>
  );
}
