import { useState } from "react";
import { FileSpreadsheet, FileUp, Plus, Trash2, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useMeetingSources, type MeetingSource } from "../hooks/useMeetingSources";
import { MeetingSheetsPickerModal } from "./MeetingSheetsPickerModal";

export function MeetingSourcePickerCard() {
  const { sources, isLoading, disconnectSource } = useMeetingSources();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="liquid-glass rounded-2xl p-4 md:p-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">Fontes da reunião</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conexão dedicada — isolada do módulo financeiro.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 bg-white/60 backdrop-blur-md border-primary/30 hover:bg-primary/[0.04]"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar
        </Button>
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState onAddSheets={() => setPickerOpen(true)} />
        ) : (
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
            {sources.map((src) => (
              <SourceCard3D
                key={src.id}
                source={src}
                onRemove={async () => {
                  try {
                    await disconnectSource.mutateAsync(src.id);
                    toast({ title: "Fonte removida" });
                  } catch (err: any) {
                    toast({ title: "Erro", description: err?.message, variant: "destructive" });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <MeetingSheetsPickerModal open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

function EmptyState({ onAddSheets }: { onAddSheets: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-white/30 p-5 text-center">
      <Layers className="h-7 w-7 mx-auto text-muted-foreground/60 mb-2" />
      <p className="text-sm font-medium text-foreground/80">Nenhuma fonte vinculada</p>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Conecte uma planilha do Google Sheets para enriquecer o contexto da próxima reunião.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={onAddSheets}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          Conectar Google Sheets
        </Button>
      </div>
    </div>
  );
}

function SourceCard3D({ source, onRemove }: { source: MeetingSource; onRemove: () => void }) {
  const isExcel = source.provider === "excel_upload" || source.provider === "drive_xlsx";
  return (
    <div
      className={cn(
        "group relative p-3.5 rounded-2xl border transition-all duration-200",
        "backdrop-blur-xl shadow-[0_4px_18px_-6px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-10px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.8)]",
        isExcel
          ? "bg-gradient-to-br from-blue-50/80 via-white/60 to-blue-100/50 border-blue-200/50"
          : "bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-100/50 border-emerald-200/50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg",
            isExcel
              ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30"
              : "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
          )}
        >
          {isExcel ? <FileUp className="h-5 w-5 text-white" /> : <FileSpreadsheet className="h-5 w-5 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight line-clamp-1 text-slate-800">
            {source.spreadsheet_name}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums",
                isExcel ? "bg-blue-500/15 text-blue-700" : "bg-emerald-500/15 text-emerald-700"
              )}
            >
              {source.selected_tabs.length} aba{source.selected_tabs.length === 1 ? "" : "s"}
            </span>
            {source.selected_tabs.slice(0, 2).map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white/70 text-slate-600 border border-black/[0.05]"
              >
                {t}
              </span>
            ))}
            {source.selected_tabs.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{source.selected_tabs.length - 2}</span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
