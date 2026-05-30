import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportsMeetingsPackage } from "../lib/financialWorkbook";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

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
  return (
    <div id="pre-meeting-report" className="liquid-glass rounded-2xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Relatorio pre-reuniao</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumo executivo, KPIs, comparativo mensal por categoria e XLSX atualizado.
          </p>
        </div>
        {reportPackage && (
          <span className="rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {reportPackage.mode === "live" ? "fonte real" : "fallback seguro"}
          </span>
        )}
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Gerando analise financeira...</p>}
      {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {!isLoading && !reportPackage && (
        <p className="mt-4 text-sm text-muted-foreground">
          Gere o relatorio para detectar a aba do mes atual, editar a DRE no XLSX e preparar a pauta.
        </p>
      )}

      {reportPackage && (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed">{reportPackage.report.executive_summary}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["Receitas", reportPackage.analysis.revenue],
              ["Despesas", reportPackage.analysis.expenses],
              ["Resultado", reportPackage.analysis.result],
              ["Lancamentos", reportPackage.analysis.transactions.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/50 bg-white/60 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {typeof value === "number" && label !== "Lancamentos" ? money(value) : value}
                </p>
              </div>
            ))}
          </div>

          <CategoryComparisonSection reportPackage={reportPackage} />

          <Section title="Riscos" items={reportPackage.report.risks} />
          <Section title="Pauta sugerida" items={reportPackage.report.suggested_agenda} />

          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-800">
              <FileSpreadsheet className="h-4 w-4" />
              XLSX atualizado pronto
            </div>
            <p className="mt-1 text-emerald-800/80">
              {reportPackage.dreUpdate.fileName} atualiza a aba {reportPackage.dreUpdate.dreSheetName}, coluna{" "}
              {reportPackage.dreUpdate.currentMonthKey}, com {reportPackage.dreUpdate.cellUpdates.length} linhas mapeadas.
            </p>
            <Button size="sm" variant="outline" className="mt-3 bg-white/70" onClick={onDownloadWorkbook}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Baixar XLSX atualizado
            </Button>
          </div>

          <details className="rounded-xl border border-white/50 bg-white/40 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Logs de auditoria</summary>
            <div className="mt-2 space-y-1">
              {reportPackage.auditLog.map((log, index) => (
                <p key={`${log}-${index}`}>{log}</p>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function CategoryComparisonSection({ reportPackage }: { reportPackage: ReportsMeetingsPackage }) {
  const items = reportPackage.analysis.categoryComparison.slice(0, 6);
  if (!items.length) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparativo por categoria</p>
        <span className="text-[11px] text-muted-foreground">
          {reportPackage.analysis.previousSheetName ?? "mes anterior nao localizado"}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.category} className="rounded-xl border border-white/50 bg-white/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.category}</p>
              <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span>Atual: {money(item.currentValue)}</span>
              <span>Anterior: {money(item.previousValue)}</span>
              <span>Variacao: {money(item.deltaValue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: ReportsMeetingsPackage["analysis"]["categoryComparison"][number]["status"]) {
  const labels = {
    up: "Aumentou",
    down: "Caiu",
    stable: "Estavel",
    new: "Nova",
    missing: "Ausente",
  };
  return labels[status];
}

function statusClass(status: ReportsMeetingsPackage["analysis"]["categoryComparison"][number]["status"]) {
  const classes = {
    up: "bg-amber-100 text-amber-900",
    down: "bg-sky-100 text-sky-900",
    stable: "bg-slate-100 text-slate-700",
    new: "bg-emerald-100 text-emerald-900",
    missing: "bg-zinc-100 text-zinc-700",
  };
  return classes[status];
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <p key={`${title}-${index}`} className="rounded-lg bg-white/50 px-3 py-2 text-sm">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
