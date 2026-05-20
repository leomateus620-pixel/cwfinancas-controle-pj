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
      {/* ============ DESKTOP / TABLET (md+) — canal 3D horizontal ============ */}
      <div
        className="hidden md:block relative"
        style={{ perspective: "1400px", perspectiveOrigin: "50% 60%" }}
      >
        <div
          className="relative h-[180px]"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Canal/sulco — paredes laterais com gradiente translúcido */}
          <div
            aria-hidden
            className="absolute inset-x-[5%] top-1/2 -translate-y-1/2 h-[120px] rounded-[28px] pointer-events-none"
            style={{
              transform: "rotateX(22deg)",
              transformStyle: "preserve-3d",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(241,245,249,0.20) 35%, rgba(226,232,240,0.10) 70%, rgba(15,23,42,0.04) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -8px 20px rgba(15,23,42,0.08), 0 18px 36px -16px rgba(15,23,42,0.18)",
              border: "1px solid rgba(255,255,255,0.55)",
            }}
          />

          {/* Atmosfera azul respirando dentro do canal */}
          {!reduce && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0.35 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-x-[8%] top-1/2 -translate-y-1/2 h-[80px] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 60% 50%, rgba(56,189,248,0.18), rgba(99,102,241,0.08) 50%, transparent 80%)",
                filter: "blur(14px)",
              }}
            />
          )}

          {/* Trilho principal — linha em perspectiva com guides */}
          <div
            className="absolute inset-x-[10%] top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Guides superior/inferior */}
            <div
              className="absolute left-0 right-0 -top-3 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(125,211,252,0.35), transparent)",
              }}
            />
            <div
              className="absolute left-0 right-0 top-3 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(125,211,252,0.35), transparent)",
              }}
            />
            {/* Trilho central */}
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(125,211,252,0) 0%, rgba(125,211,252,0.65) 15%, rgba(255,255,255,0.9) 50%, rgba(110,231,183,0.65) 85%, rgba(110,231,183,0) 100%)",
                boxShadow:
                  "0 0 12px rgba(125,211,252,0.55), 0 0 4px rgba(255,255,255,0.7)",
              }}
            />
          </div>

          {/* Sparks (pontos de luz) viajando — loop */}
          {!reduce &&
            sparks.map((p) => (
              <motion.div
                key={p.id}
                aria-hidden
                initial={{ left: "6%", opacity: 0 }}
                animate={{
                  left: ["6%", "94%"],
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
                  top: `calc(50% + ${p.offset}px)`,
                  width: p.size,
                  height: p.size,
                  filter: "blur(0.5px) drop-shadow(0 0 5px rgba(125,211,252,0.95))",
                  mixBlendMode: "screen",
                }}
              />
            ))}

          {/* Camada de conteúdo: origem | checkpoints | destino */}
          <div className="relative h-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-[3%]">
            {/* Origem */}
            <div style={{ transformStyle: "preserve-3d" }}>
              <DemandOriginCard
                typeKey={typeKey}
                typeLabel={typeLabel}
                code={code}
                priority={priority}
              />
            </div>

            {/* Checkpoints distribuídos sobre o trilho */}
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-center justify-around">
                {STATIONS.map((st, i) => (
                  <div key={st.id} className="flex flex-col items-center">
                    <FlowStationCard
                      label={st.label}
                      Icon={st.Icon}
                      state={stationState(i)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Núcleo CW */}
            <div className="flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
              <CWLogoDestination arrived={arrived} size="md" showLabel />
            </div>
          </div>

          {/* Puck — token da demanda atravessando o canal */}
          {!reduce && (
            <>
              {/* Halo do puck */}
              <motion.div
                initial={{ left: "12%", opacity: 0, scale: 0.7 }}
                animate={{
                  left: ["12%", "32%", "52%", "72%", "88%"],
                  opacity: [0, 0.85, 1, 0.85, 0],
                  scale: [0.7, 1.3, 1.5, 1.3, 0.5],
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.7,
                  times: [0, 0.25, 0.5, 0.75, 1],
                  ease: "easeInOut",
                }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-16 h-16 rounded-full pointer-events-none z-[6]"
                style={{
                  background:
                    "radial-gradient(circle, rgba(125,211,252,0.6), rgba(59,130,246,0.25) 40%, transparent 70%)",
                  filter: "blur(8px)",
                  mixBlendMode: "screen",
                }}
              />

              {/* Puck */}
              <motion.div
                initial={{ left: "12%", scale: 1, opacity: 0, rotateY: 0, y: 0 }}
                animate={{
                  left: ["12%", "32%", "52%", "72%", "88%"],
                  scale: [1, 0.96, 0.92, 0.86, 0.55],
                  opacity: [0, 1, 1, 1, 0],
                  rotateY: [0, 10, -8, 10, 0],
                  y: [0, -4, 3, -3, 0],
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.7,
                  times: [0, 0.25, 0.5, 0.75, 1],
                  type: "spring",
                  stiffness: 60,
                  damping: 18,
                  mass: 0.9,
                }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-[7]"
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
