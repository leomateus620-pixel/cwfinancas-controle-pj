import { useState } from "react";
import { usePayableReceivable } from "@/hooks/usePayableReceivable";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { PayableCard } from "@/components/accounts/PayableCard";
import { ReceivableCard } from "@/components/accounts/ReceivableCard";
import { ClipboardList, ChevronLeft, ChevronRight, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getPeriodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(periodKey: string): string {
  const [year, month] = periodKey.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export default function AccountsPage() {
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const periodKey = getPeriodKey(currentDate);

  const { connections, syncAllTabs } = useGoogleSheets();
  const latestConnectionId = connections && connections.length > 0 ? connections[0]?.id : undefined;
  const { payable, receivable, payableAggregates, receivableAggregates, isLoading } = usePayableReceivable(periodKey, latestConnectionId);

  const isSyncing = syncAllTabs.isPending;
  const hasData = payable.length > 0 || receivable.length > 0;

  const handleImport = () => {
    if (connections && connections.length > 0) {
      syncAllTabs.mutate({ connectionId: connections[0].id });
    }
  };

  const goToPrev = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNext = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Empty state
  if (!isLoading && !hasData && !isSyncing) {
    return (
      <div className="space-y-6 animate-corporate-enter home-glass-bg min-h-[60vh] p-1">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Contas a Pagar / Receber</h1>
        </div>
        <div className="liquid-glass p-12 text-center space-y-6 relative overflow-hidden">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-primary/3 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="p-3 rounded-2xl bg-primary/5 w-fit mx-auto">
              <FileSpreadsheet className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma conta importada</h3>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
              Conecte uma planilha com abas <strong className="text-foreground/80">"Contas a pagar"</strong> e <strong className="text-foreground/80">"Contas a receber"</strong> para gerenciar suas obrigações e recebíveis.
            </p>
            {connections && connections.length > 0 && (
              <Button onClick={handleImport} disabled={isSyncing} className="mt-2">
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Importar Contas
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contas a Pagar / Receber</h1>
            <p className="text-sm text-muted-foreground">Gestão operacional de obrigações e recebíveis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Re-sync button */}
          {connections && connections.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleImport} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          )}

          {/* Month selector */}
          <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-xl border border-border/50 px-2 py-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
              {formatMonthLabel(periodKey)}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PayableCard records={payable} aggregates={payableAggregates} isLoading={isLoading} />
        <ReceivableCard records={receivable} aggregates={receivableAggregates} isLoading={isLoading} />
      </div>
    </div>
  );
}
