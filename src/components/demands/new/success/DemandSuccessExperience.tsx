import { motion, useReducedMotion } from "framer-motion";
import { useDemand } from "@/hooks/useDemand";
import { PRIORITY_OPTIONS } from "@/lib/demands/types";
import { DemandMiniCard } from "./DemandMiniCard";
import { DemandJourneyTunnel3D } from "./DemandJourneyTunnel3D";
import { DemandSuccessSummaryCard } from "./DemandSuccessSummaryCard";
import { buildDemandSummary, getTypeLabel } from "./buildDemandSummary";
import type { DemandFormState } from "../SmartDemandForm";

interface Props {
  demandId: string;
  form: DemandFormState;
  onNew: () => void;
}

export function DemandSuccessExperience({ demandId, form, onNew }: Props) {
  const reduce = useReducedMotion();
  const { data: demand } = useDemand(demandId);
  const code = demand?.demand_code ?? demandId.slice(0, 8).toUpperCase();
  const typeLabel = getTypeLabel(form.demand_type);
  const summaryText = buildDemandSummary(form);
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === form.priority)?.label;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* ÁREA 1 — Mini card no topo */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.28, ease: "easeOut" }}
        className="flex justify-center"
      >
        <DemandMiniCard
          code={code}
          typeKey={form.demand_type}
          typeLabel={typeLabel}
          title={form.title || "Demanda enviada"}
          company={form.requester_company}
          requester={form.requester_name}
          priorityLabel={priorityLabel}
          amount={form.amount || undefined}
        />
      </motion.div>

      {/* ÁREA 2 — Túnel 3D + Logo CW */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? undefined : { delay: 0.25, duration: 0.36, ease: "easeOut" }}
      >
        <DemandJourneyTunnel3D typeKey={form.demand_type} />
      </motion.div>

      {/* ÁREA 3 — Card final de agradecimento */}
      <DemandSuccessSummaryCard
        code={code}
        typeLabel={typeLabel}
        title={form.title || "Demanda enviada"}
        requester={form.requester_name}
        company={form.requester_company}
        summaryText={summaryText}
        asanaStatus={demand?.asana_sync_status ?? null}
        demandId={demandId}
        onNew={onNew}
      />
    </div>
  );
}
