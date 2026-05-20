import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Inbox, Search, Users } from "lucide-react";
import { DemandTypeIcon, type DemandIconKey } from "@/components/demands/ui/DemandTypeIcon";
import { CWLogoDestination } from "./CWLogoDestination";
import { FlowStationCard } from "./FlowStationCard";
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

const STATION_DELAYS_MS = [620, 1000, 1380];
const ARRIVAL_DELAY_MS = 1780;

/**
 * Faixa visual com física 3D real (perspectiva CSS + spring) onde a demanda
 * percorre estações intermediárias até chegar na logo da CW Finanças.
 *
 * Composição: [origem] → [Recebida] → [Em análise] → [Equipe CW] → [Logo CW]
 */
export function DemandFlowSection({ typeKey, typeLabel }: Props) {
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState<number>(reduce ? STATIONS.length - 1 : -1);
  const [arrived, setArrived] = useState<boolean>(!!reduce);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    STATION_DELAYS_MS.forEach((ms, i) => {
      timers.push(window.setTimeout(() => setActiveIdx((cur) => Math.max(cur, i)), ms));
    });
    timers.push(window.setTimeout(() => setArrived(true), ARRIVAL_DELAY_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  return (
    <div className="relative">
      {/* ============ DESKTOP / TABLET (md+) — fluxo horizontal ============ */}
      <div
        className="hidden md:block relative"
        style={{ perspective: "900px", perspectiveOrigin: "50% 50%" }}
      >
        {/* Trilha sutil de fundo */}
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-blue-400/35 to-transparent pointer-events-none" />
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[3px] -mt-px rounded-full bg-gradient-to-r from-blue-400/0 via-blue-400/15 to-emerald-400/0 blur-sm pointer-events-none" />

        {/* Pulso de "envio" percorrendo a trilha */}
        {!reduce && (
          <motion.div
            initial={{ left: "10%", opacity: 0 }}
            animate={{ left: ["10%", "90%"], opacity: [0, 1, 1, 0.4] }}
            transition={{ duration: 1.4, times: [0, 0.1, 0.85, 1], ease: "easeInOut", delay: 0.35 }}
            className="absolute top-1/2 -translate-y-1/2 h-1 w-16 rounded-full bg-gradient-to-r from-transparent via-blue-400/70 to-transparent blur-[2px] pointer-events-none"
          />
        )}

        <div className="relative grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-1.5 lg:gap-2">
          {/* Origem */}
          <OriginCard typeKey={typeKey} typeLabel={typeLabel} />
          <Connector />
          <FlowStationCard label={STATIONS[0].label} Icon={STATIONS[0].Icon} active={activeIdx >= 0} />
          <Connector />
          <FlowStationCard label={STATIONS[1].label} Icon={STATIONS[1].Icon} active={activeIdx >= 1} />
          <Connector />
          <FlowStationCard label={STATIONS[2].label} Icon={STATIONS[2].Icon} active={activeIdx >= 2} />
          <Connector />
          <div className="flex items-center justify-center">
            <CWLogoDestination arrived={arrived} size="md" />
          </div>
        </div>

        {/* Puck — token da demanda viajando com física 3D real */}
        {!reduce && (
          <motion.div
            initial={{ left: "4%", scale: 1, opacity: 0 }}
            animate={{
              left: ["4%", "26%", "48%", "70%", "92%"],
              scale: [1, 0.95, 0.92, 0.88, 0.55],
              opacity: [0, 1, 1, 1, 0],
              rotateY: [0, 8, -6, 6, 0],
              y: [0, -3, 2, -2, 0],
            }}
            transition={{
              duration: 1.6,
              times: [0, 0.25, 0.5, 0.75, 1],
              delay: 0.45,
              ease: [0.45, 0.05, 0.3, 1],
            }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="rounded-xl bg-white/95 backdrop-blur-xl border border-white/80 px-2 py-1.5 flex items-center gap-1.5"
              style={{
                boxShadow:
                  "0 12px 30px -10px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.95)",
              }}
            >
              <DemandTypeIcon kind={(typeKey as DemandIconKey) || "outro"} size="sm" />
            </div>
          </motion.div>
        )}
      </div>

      {/* ============ MOBILE (<md) — fluxo vertical compacto ============ */}
      <div className="md:hidden flex flex-col items-stretch gap-2">
        <OriginCard typeKey={typeKey} typeLabel={typeLabel} mobile />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[0].label}
          Icon={STATIONS[0].Icon}
          active={activeIdx >= 0}
          orientation="vertical"
        />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[1].label}
          Icon={STATIONS[1].Icon}
          active={activeIdx >= 1}
          orientation="vertical"
        />
        <VerticalConnector />
        <FlowStationCard
          label={STATIONS[2].label}
          Icon={STATIONS[2].Icon}
          active={activeIdx >= 2}
          orientation="vertical"
        />
        <VerticalConnector />
        <div className="flex justify-center pt-1">
          <CWLogoDestination arrived={arrived} size="md" />
        </div>
      </div>

      {/* Confirmação textual discreta */}
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
        "inline-flex items-center gap-2 rounded-xl bg-white/80 border border-white/70 backdrop-blur-xl",
        mobile ? "px-3 py-2 w-full justify-center" : "px-2.5 py-2",
      )}
      style={{
        boxShadow:
          "0 8px 22px -10px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
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
      <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
    </div>
  );
}

function VerticalConnector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-3 bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />
    </div>
  );
}
