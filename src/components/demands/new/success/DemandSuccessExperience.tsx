import { GlassCard } from "@/components/home/GlassCard";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useDemand } from "@/hooks/useDemand";
import { DemandFlowSection } from "./DemandFlowSection";
import { SuccessActionButtons } from "./SuccessActionButtons";
import { buildDemandSummary, getTypeLabel } from "./buildDemandSummary";
import { cn } from "@/lib/utils";
import type { DemandFormState } from "../SmartDemandForm";

interface Props {
  demandId: string;
  form: DemandFormState;
  onNew: () => void;
}

function readInterpretationSummary(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Record<string, unknown>;
  const i = meta.interpretation;
  if (typeof i === "string") {
    try {
      const parsed = JSON.parse(i);
      if (parsed && typeof parsed.summary === "string" && parsed.summary.trim()) return parsed.summary.trim();
    } catch { /* ignore */ }
  } else if (i && typeof i === "object" && typeof (i as { summary?: unknown }).summary === "string") {
    const s = (i as { summary: string }).summary.trim();
    if (s) return s;
  }
  return null;
}

/**
 * Tela final de confirmação após envio da demanda.
 *
 * Composição (de cima para baixo, dentro de um único card central):
 *   1. Header: check + título + subtítulo de agradecimento
 *   2. Bloco de resumo (grid de metadados + linha de resumo)
 *   3. Faixa visual: [Sua demanda] → estações → Logo CW (com física 3D real)
 *   4. Botões de ação
 */
export function DemandSuccessExperience({ demandId, form, onNew }: Props) {
  const reduce = useReducedMotion();
  const { data: demand } = useDemand(demandId);
  const code = demand?.demand_code ?? demandId.slice(0, 8).toUpperCase();
  const typeLabel = getTypeLabel(form.demand_type);
  const interpretedSummary = readInterpretationSummary((demand as { requester_metadata?: unknown } | null)?.requester_metadata);
  const summaryText = interpretedSummary || buildDemandSummary(form);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.36, ease: "easeOut" }}
      >
        <GlassCard variant="highlight" className="relative overflow-hidden p-6 md:p-8">
          {/* Orbs decorativos */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-400/18 blur-3xl" />
            <div className="absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-blue-400/15 blur-3xl" />
          </div>

          <div className="relative space-y-6 md:space-y-7">
            {/* 1. HEADER */}
            <Header />

            {/* 2. RESUMO */}
            <SummaryBlock
              code={code}
              typeLabel={typeLabel}
              requester={form.requester_name}
              company={form.requester_company}
              summaryText={summaryText}
            />

            {/* 3. FLUXO CW PREMIUM */}
            <DemandFlowSection
              typeKey={form.demand_type}
              typeLabel={typeLabel}
              code={code}
              priority={form.priority}
            />

            {/* 4. BOTÕES */}
            <div className="pt-1">
              <SuccessActionButtons demandId={demandId} onNew={onNew} />
            </div>

            {/* Rodapé */}
            <p className="text-center text-[11.5px] text-muted-foreground -mt-2">
              Caso seja necessário complementar alguma informação, a equipe da CW entrará em contato.
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function Header() {
  return (
    <div className="text-center md:text-left">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2.5 py-1 mb-3">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-emerald-700 font-semibold">
          Demanda recebida
        </span>
      </div>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
        Solicitação recebida com sucesso
      </h2>
      <p className="text-sm md:text-[15px] text-foreground/75 mt-2 leading-relaxed max-w-2xl mx-auto md:mx-0">
        Obrigado pela solicitação. A equipe da CW Finanças irá analisar sua demanda e dará
        andamento o mais breve possível.
      </p>
    </div>
  );
}

function SummaryBlock({
  code,
  typeLabel,
  requester,
  company,
  summaryText,
}: {
  code: string;
  typeLabel: string;
  requester?: string;
  company?: string;
  summaryText: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5">
        <Meta label="Código" value={code} mono />
        <Meta label="Status" value="Em análise" pill="emerald" />
        {requester && <Meta label="Solicitante" value={requester} />}
        {company && <Meta label="Empresa" value={company} />}
      </div>
      <div className="rounded-xl bg-white/55 border border-black/[0.05] backdrop-blur-md px-3.5 py-2.5">
        <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          Resumo
        </div>
        <div className="text-[13px] md:text-sm text-foreground/85 mt-1 leading-snug">
          {summaryText}
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  pill,
}: {
  label: string;
  value: string;
  mono?: boolean;
  pill?: "emerald";
}) {
  return (
    <div className="rounded-xl bg-white/55 border border-black/[0.05] backdrop-blur-md px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={cn("text-sm font-medium mt-0.5 break-words", mono && "font-mono tabular-nums")}>
        {pill === "emerald" ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 text-[12px]">
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-foreground/12" />
      <span className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-foreground/12" />
    </div>
  );
}
