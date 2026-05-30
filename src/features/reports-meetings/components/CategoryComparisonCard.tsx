import { useMemo, useState } from "react";
import { ChevronDown, CircleMinus, CirclePlus, Layers3, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryComparison, ReportsMeetingsPackage } from "../lib/financialWorkbook";
import { GlassPanel, MetricCard, StatusBadge } from "./reportsMeetingUi";
import { humanizeMonth, money, percent } from "./reportsMeetingFormat";

export function CategoryComparisonCard({ reportPackage }: { reportPackage: ReportsMeetingsPackage | null }) {
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => reportPackage?.analysis.categoryComparison ?? [], [reportPackage]);
  const visibleItems = showAll ? items : items.slice(0, 5);
  const summary = useMemo(() => buildSummary(items), [items]);
  const status = !reportPackage
    ? { label: "Pendente", tone: "neutral" as const }
    : !reportPackage.analysis.previousSheetName
      ? { label: "Mês anterior não encontrado", tone: "warning" as const }
      : !items.length
        ? { label: "Dados insuficientes", tone: "warning" as const }
        : { label: "Comparação pronta", tone: "success" as const };

  return (
    <GlassPanel featured className="p-4 sm:p-5 md:p-6">
      <div className="pointer-events-none absolute inset-x-4 top-3 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <div className="relative space-y-5 md:space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex rounded-full border border-emerald-200/80 bg-white/58 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm backdrop-blur">
              Mês atual x mês anterior
            </div>
            <h2 className="mt-3 text-[1.35rem] font-bold tracking-[-0.03em] text-slate-950 sm:text-2xl md:text-[1.7rem]">
              Comparação de categorias
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              {reportPackage
                ? `Análise entre ${humanizeMonth(reportPackage.analysis.latestMonthLabel)} e ${humanizeMonth(
                    reportPackage.analysis.previousSheetName,
                  )}`
                : "Gere o relatório pré-reunião para comparar categorias financeiras."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <StatusBadge tone={status.tone} className="shadow-[0_8px_20px_-14px_rgba(16,185,129,0.7)]">
              {status.label}
            </StatusBadge>
            {items.length > 5 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-white/70 bg-white/70 px-3 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/90 active:scale-[0.98]"
                onClick={() => setShowAll((open) => !open)}
              >
                {showAll ? "Ver menos" : "Ver detalhes"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Maior aumento"
            value={summary.biggestIncrease?.label ?? "—"}
            detail={summary.biggestIncrease?.detail ?? "Aguardando dados"}
            tone="warning"
            icon={<TrendingUp className="h-4 w-4" />}
            className="min-h-[132px] border-amber-100/80"
          />
          <MetricCard
            label="Maior redução"
            value={summary.biggestDrop?.label ?? "—"}
            detail={summary.biggestDrop?.detail ?? "Aguardando dados"}
            tone="info"
            icon={<TrendingDown className="h-4 w-4" />}
            className="min-h-[132px] border-blue-100/80"
          />
          <MetricCard
            label="Categorias novas"
            value={summary.newCount}
            detail={`${summary.missingCount} ausente${summary.missingCount === 1 ? "" : "s"}`}
            tone="success"
            icon={<CirclePlus className="h-4 w-4" />}
            className="min-h-[132px] border-emerald-100/80"
          />
          <MetricCard
            label="Total analisado"
            value={items.length || "—"}
            detail="Categorias comparadas"
            tone="neutral"
            icon={<Layers3 className="h-4 w-4" />}
            className="min-h-[132px]"
          />
        </div>

        {items.length ? (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <ExpandableCategoryRow key={item.category} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-emerald-200/90 bg-white/55 p-5 text-sm leading-6 text-slate-600 shadow-inner">
            A comparação será exibida aqui assim que houver dados do mês atual e, quando possível, do mês anterior.
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function ExpandableCategoryRow({ item }: { item: CategoryComparison }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(item.status);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/75 bg-white/72 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.62),0_1px_0_rgba(255,255,255,0.9)_inset] transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-emerald-200/90 hover:bg-white/86 hover:shadow-[0_20px_52px_-32px_rgba(15,23,42,0.7),0_1px_0_rgba(255,255,255,0.95)_inset] active:scale-[0.992]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-col gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3 lg:max-w-[36%]">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm", meta.iconClass)}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-slate-950">{item.category}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Confiança do mapeamento: {confidenceLabel(item.confidence)}</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 text-xs min-[520px]:grid-cols-4 lg:min-w-[520px] lg:grid-cols-[1fr_1fr_1fr_0.9fr_auto] lg:text-right">
          <Value label="Atual" value={money(item.currentValue)} />
          <Value label="Anterior" value={money(item.previousValue)} />
          <Value label="Diferença" value={money(item.deltaValue)} emphasized />
          <Value label="Variação" value={percent(item.deltaPercent)} />
          <div className="col-span-2 flex items-center justify-between gap-2 pt-1 min-[520px]:col-span-4 lg:col-span-1 lg:justify-end lg:pt-0">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-300", open && "rotate-180 text-emerald-600")} />
          </div>
        </div>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mx-3.5 mb-3.5 rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 via-white/78 to-blue-50/45 p-3.5 text-sm leading-6 text-slate-600 shadow-inner sm:mx-4 sm:mb-4 sm:p-4">
            <p>{variationText(item)}</p>
            <div className="mt-3 grid gap-2.5 md:grid-cols-3">
              <Info label="Lançamentos principais" value={mainEntriesText(item)} />
              <Info label="Observação automática" value={observationText(item)} />
              <Info label="Ação recomendada" value={actionText(item)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Value({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50/55 px-2.5 py-2 lg:bg-transparent lg:px-0 lg:py-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cn("mt-1 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-700", emphasized && "text-slate-950")}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/85 bg-white/72 p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{value}</p>
    </div>
  );
}

function buildSummary(items: CategoryComparison[]) {
  const biggestIncrease = items.find((item) => item.status === "up" || item.status === "new");
  const biggestDrop = items.find((item) => item.status === "down" || item.status === "missing");
  return {
    biggestIncrease: biggestIncrease ? { label: money(Math.abs(biggestIncrease.deltaValue)), detail: biggestIncrease.category } : null,
    biggestDrop: biggestDrop ? { label: money(Math.abs(biggestDrop.deltaValue)), detail: biggestDrop.category } : null,
    newCount: items.filter((item) => item.status === "new").length,
    missingCount: items.filter((item) => item.status === "missing").length,
  };
}

function statusMeta(status: CategoryComparison["status"]) {
  const map = {
    up: { label: "Aumentou", tone: "warning" as const, icon: <TrendingUp className="h-4 w-4" />, iconClass: "border-amber-200 bg-amber-50 text-amber-700" },
    down: { label: "Reduziu", tone: "info" as const, icon: <TrendingDown className="h-4 w-4" />, iconClass: "border-blue-200 bg-blue-50 text-blue-700" },
    stable: { label: "Estável", tone: "neutral" as const, icon: <CircleMinus className="h-4 w-4" />, iconClass: "border-slate-200 bg-slate-50 text-slate-600" },
    new: { label: "Nova", tone: "success" as const, icon: <CirclePlus className="h-4 w-4" />, iconClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    missing: { label: "Ausente", tone: "neutral" as const, icon: <CircleMinus className="h-4 w-4" />, iconClass: "border-zinc-200 bg-zinc-50 text-zinc-700" },
  };
  return map[status];
}

function confidenceLabel(confidence: CategoryComparison["confidence"]) {
  return { high: "alta", medium: "média", low: "baixa" }[confidence];
}

function variationText(item: CategoryComparison) {
  if (item.status === "new") return `Categoria nova no mês atual, com ${money(item.currentValue)} registrados.`;
  if (item.status === "missing") return `Categoria ausente no mês atual; no mês anterior somava ${money(item.previousValue)}.`;
  if (item.status === "stable") return `Categoria estável, com diferença de ${money(item.deltaValue)} (${percent(item.deltaPercent)}).`;
  return `${statusMeta(item.status).label} ${money(Math.abs(item.deltaValue))} em relação ao mês anterior (${percent(item.deltaPercent)}).`;
}

function mainEntriesText(item: CategoryComparison) {
  if (item.currentLabel && item.previousLabel) return `${item.currentLabel} comparado com ${item.previousLabel}.`;
  return item.currentLabel ?? item.previousLabel ?? "Sem lançamentos detalhados disponíveis nesta visão.";
}

function observationText(item: CategoryComparison) {
  if (item.confidence === "high") return "Mapeamento consistente entre os dois períodos.";
  if (item.status === "new" || item.status === "missing") return "Acompanhar nomenclatura para evitar duplicidade de categoria.";
  return "Validar categoria na reunião caso a variação seja material.";
}

function actionText(item: CategoryComparison) {
  if (item.status === "up") return "Entender a causa do aumento e confirmar recorrência.";
  if (item.status === "down") return "Registrar se a redução é economia real ou postergação.";
  if (item.status === "new") return "Classificar responsáveis e recorrência prevista.";
  if (item.status === "missing") return "Confirmar se deixou de existir ou se mudou de nome.";
  return "Manter acompanhamento mensal.";
}
