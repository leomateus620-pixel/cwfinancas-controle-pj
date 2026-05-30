import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Download, FileSpreadsheet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportsMeetingsPackage } from "../lib/financialWorkbook";
import { GlassPanel, MetricCard, StatusBadge } from "./reportsMeetingUi";
import { humanizeMonth, money, percent } from "./reportsMeetingFormat";

export function PreMeetingReportPanel({
  reportPackage,
  isLoading,
  error,
  onDownloadWorkbook,
}: {
  reportPackage: ReportsMeetingsPackage | null;
  isLoading?: boolean;
  error?: string | null;
  onDownloadWorkbook?: () => void;
}) {
  const status = reportPackage
    ? reportPackage.mode === "live"
      ? { label: "Gerado", tone: "success" as const }
      : { label: "Fallback seguro", tone: "warning" as const }
    : { label: "Pendente", tone: "neutral" as const };

  return (
    <GlassPanel id="pre-meeting-report" className="space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-950">Relatório pré-reunião</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Resumo executivo com KPIs, riscos e pauta para conduzir a reunião com contexto financeiro confiável.
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      {isLoading && <p className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-800">Gerando análise financeira...</p>}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-800">{error}</p>}

      {!isLoading && !reportPackage && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/45 p-4 text-sm leading-relaxed text-slate-600">
          Gere o relatório para detectar o mês atual, preparar a DRE offline e sugerir uma pauta objetiva para a conversa.
        </p>
      )}

      {reportPackage && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-inner">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Mês analisado: {humanizeMonth(reportPackage.analysis.latestMonthLabel)}
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-700">{reportPackage.report.executive_summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <MetricCard className="min-h-[122px]" label="Receitas" value={money(reportPackage.analysis.revenue)} tone="success" detail="Entradas do período" />
            <MetricCard className="min-h-[122px]" label="Despesas" value={money(reportPackage.analysis.expenses)} tone="warning" detail="Saídas normalizadas" />
            <MetricCard className="min-h-[122px]" label="Resultado" value={money(reportPackage.analysis.result)} tone={reportPackage.analysis.result >= 0 ? "success" : "danger"} detail={reportPackage.analysis.result >= 0 ? "Positivo" : "Negativo"} />
            <MetricCard className="min-h-[122px]" label="Lançamentos" value={reportPackage.analysis.transactions.length} tone="info" detail="Registros analisados" />
            <MetricCard className="min-h-[122px]" label="Margem" value={percent(reportPackage.analysis.margin)} tone="neutral" detail="Resultado / receita" />
          </div>

          <ReportSectionCard title="Riscos" items={reportPackage.report.risks} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
          <ReportSectionCard title="Pauta sugerida" items={reportPackage.report.suggested_agenda} icon={<Sparkles className="h-4 w-4" />} tone="info" />
          <DreOfflineCard reportPackage={reportPackage} onDownloadWorkbook={onDownloadWorkbook} />
          <AuditTimeline logs={reportPackage.auditLog} />
        </div>
      )}
    </GlassPanel>
  );
}

function DreOfflineCard({ reportPackage, onDownloadWorkbook }: { reportPackage: ReportsMeetingsPackage; onDownloadWorkbook?: () => void }) {
  const mappingStatus = reportPackage.dreUpdate.warnings.length
    ? reportPackage.dreUpdate.cellUpdates.length
      ? "Mapeamento parcial"
      : "Template mínimo aplicado"
    : "Template real detectado";
  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white/74 to-emerald-50/62 p-4 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.65)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-emerald-900">
            <FileSpreadsheet className="h-4 w-4" /> DRE offline pronta
          </div>
          <p className="mt-1 text-sm text-emerald-900/75">Arquivo gerado sem alterar a planilha conectada.</p>
        </div>
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onDownloadWorkbook}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar DRE
        </Button>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <Info label="Arquivo" value={reportPackage.dreUpdate.fileName} />
        <Info label="Período analisado" value={humanizeMonth(reportPackage.dreUpdate.currentMonthLabel)} />
        <Info label="Status do mapeamento" value={mappingStatus} />
      </div>
      {reportPackage.dreUpdate.warnings.length > 0 && (
        <div className="mt-3 space-y-1 rounded-xl border border-amber-200/80 bg-amber-50/75 p-3 text-xs text-amber-800">
          {reportPackage.dreUpdate.warnings.map((warning, index) => (
            <p key={`${warning}-${index}`}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTimeline({ logs }: { logs: string[] }) {
  return (
    <details className="group rounded-2xl border border-white/70 bg-white/45 p-3 text-sm text-slate-600 open:bg-white/62">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <span>Logs de auditoria</span>
        <StatusBadge tone="neutral">{logs.length} eventos</StatusBadge>
      </summary>
      <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
        {logs.map((log, index) => (
          <div key={`${log}-${index}`} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={auditTone(log)}>{auditLabel(log)}</StatusBadge>
              <span className="text-[11px] font-medium text-slate-400">Evento {index + 1}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{log}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ReportSectionCard({ title, items, icon, tone }: { title: string; items: string[]; icon: ReactNode; tone: "warning" | "info" }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/52 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={tone === "warning" ? "text-amber-600" : "text-blue-600"}>{icon}</span>
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <p key={`${title}-${index}`} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm leading-relaxed text-slate-700 shadow-sm">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/75 bg-white/58 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700/70">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-800" title={value}>{value}</p>
    </div>
  );
}

function auditLabel(log: string) {
  const normalized = log.toLowerCase();
  if (normalized.includes("dre") || normalized.includes("xlsx")) return "DRE";
  if (normalized.includes("compar")) return "Comparação";
  if (normalized.includes("fallback")) return "Fallback";
  if (normalized.includes("erro")) return "Erro";
  return "Leitura";
}

function auditTone(log: string) {
  const label = auditLabel(log);
  if (label === "Erro") return "danger" as const;
  if (label === "Fallback") return "warning" as const;
  if (label === "DRE") return "success" as const;
  if (label === "Comparação") return "info" as const;
  return "neutral" as const;
}
