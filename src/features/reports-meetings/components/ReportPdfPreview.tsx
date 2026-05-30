import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportElementAsPdf } from "../lib/pdfExport";

export function ReportPdfPreview() {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/58 p-4 shadow-[0_12px_34px_-26px_rgba(15,23,42,0.5)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Exportação executiva</p>
          <p className="mt-1 text-xs text-slate-500">Gere uma versão em PDF do relatório pré-reunião.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl bg-white/70 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          onClick={() => exportElementAsPdf("pre-meeting-report", "relatorio-pre-reuniao")}
        >
          <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
      </div>
    </div>
  );
}
