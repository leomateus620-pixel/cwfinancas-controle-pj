import { useState } from "react";
import { usePayableReceivable } from "@/hooks/usePayableReceivable";
import { PayableCard } from "@/components/accounts/PayableCard";
import { ReceivableCard } from "@/components/accounts/ReceivableCard";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
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

  const { payable, receivable, payableAggregates, receivableAggregates, isLoading } = usePayableReceivable(periodKey);

  const goToPrev = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNext = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

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

      {/* Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PayableCard records={payable} aggregates={payableAggregates} isLoading={isLoading} />
        <ReceivableCard records={receivable} aggregates={receivableAggregates} isLoading={isLoading} />
      </div>
    </div>
  );
}
