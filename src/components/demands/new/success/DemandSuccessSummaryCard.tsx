import { GlassCard } from "@/components/home/GlassCard";
import { CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SuccessActionButtons } from "./SuccessActionButtons";

interface Props {
  code: string;
  typeLabel: string;
  title: string;
  requester?: string;
  company?: string;
  summaryText: string;
  asanaStatus?: string | null;
  demandId: string;
  onNew: () => void;
}

export function DemandSuccessSummaryCard({
  code,
  typeLabel,
  title,
  requester,
  company,
  summaryText,
  asanaStatus,
  demandId,
  onNew,
}: Props) {
  const reduce = useReducedMotion();

  const asanaText =
    asanaStatus === "synced"
      ? "Encaminhada para a equipe."
      : "Solicitação registrada. A equipe será notificada automaticamente.";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? undefined : { delay: 1.7, duration: 0.32, ease: "easeOut" }}
    >
      <GlassCard variant="highlight" className="p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-blue-400/15 blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-emerald-700 font-semibold">
              Solicitação recebida com sucesso
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Obrigado pela solicitação.</h2>
          <p className="text-sm md:text-[15px] text-foreground/80 mt-2 leading-relaxed max-w-2xl">
            {summaryText}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Sua demanda já entrou no fluxo de análise da equipe CW.
            Você pode acompanhar tudo pela Central de Demandas.
          </p>

          {/* Mini-grid de meta-dados */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Meta label="Código" value={code} mono />
            <Meta label="Status" value="Recebida" pill="emerald" />
            <Meta label="Tipo" value={typeLabel} />
            <Meta label="Próximo passo" value="Análise da equipe CW" />
            {requester && <Meta label="Solicitante" value={requester} />}
            {company && <Meta label="Empresa" value={company} />}
            <div className="col-span-2 md:col-span-4">
              <Meta label="Resumo" value={title} />
            </div>
          </div>

          {/* Status Asana — apenas mensagem amigável */}
          <div className="mt-4 rounded-xl bg-primary/[0.06] border border-primary/15 px-3 py-2 text-[12px] text-foreground/75">
            {asanaText}
          </div>

          <div className="mt-6">
            <SuccessActionButtons demandId={demandId} onNew={onNew} />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function Meta({ label, value, mono, pill }: { label: string; value: string; mono?: boolean; pill?: "emerald" }) {
  return (
    <div className="rounded-xl bg-white/55 border border-black/[0.05] backdrop-blur-md px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`text-sm font-medium mt-0.5 break-words ${mono ? "font-mono tabular-nums" : ""}`}>
        {pill === "emerald" ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/15 text-[12px]">
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
