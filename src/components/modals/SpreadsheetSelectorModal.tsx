import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  ChevronRight, 
  Loader2, 
  Table,
  CheckCircle,
  Calendar,
  Info,
  Search,
  RefreshCw,
  Users
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Spreadsheet {
  id: string;
  name: string;
  modified_time: string;
  owner?: string;
  shared?: boolean;
}

interface Sheet {
  sheet_id: number;
  title: string;
  index: number;
}

interface MonthRange {
  from: string;
  to: string;
}

interface SpreadsheetSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spreadsheets: Spreadsheet[] | undefined;
  nextPageToken?: string;
  isLoadingSpreadsheets: boolean;
  onLoadSpreadsheets: (params?: { searchTerm?: string; pageToken?: string }) => void;
  onGetSheets: (spreadsheetId: string) => void;
  sheetsData: { spreadsheet_name: string; sheets: Sheet[] } | undefined;
  isLoadingSheets: boolean;
  onCreateConnection: (params: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetName: string | null;
    monthRange?: MonthRange;
  }) => Promise<void>;
  isCreatingConnection: boolean;
}

type Step = "spreadsheets" | "sheets" | "month-range" | "confirm";

const MONTH_FULL: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MONTH_ABBR: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const MONTH_LABELS: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

function detectMonthFromTab(tabName: string): { monthIndex: number; year: number } | null {
  const normalized = tabName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const defaultYear = new Date().getFullYear();

  for (const [name, idx] of Object.entries(MONTH_FULL)) {
    const regex = new RegExp(`^${name}[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      let year = defaultYear;
      if (match[1]) { const n = parseInt(match[1]); year = n >= 100 ? n : n >= 50 ? 1900 + n : 2000 + n; }
      return { monthIndex: idx, year };
    }
  }

  for (const [abbr, idx] of Object.entries(MONTH_ABBR)) {
    const regex = new RegExp(`^${abbr}\\.?[\\s\\/\\-]*(\\d{2,4})?$`, "i");
    const match = normalized.match(regex);
    if (match) {
      let year = defaultYear;
      if (match[1]) { const n = parseInt(match[1]); year = n >= 100 ? n : n >= 50 ? 1900 + n : 2000 + n; }
      return { monthIndex: idx, year };
    }
  }

  return null;
}

function formatModifiedTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export function SpreadsheetSelectorModal({ 
  open, 
  onOpenChange,
  spreadsheets,
  nextPageToken,
  isLoadingSpreadsheets,
  onLoadSpreadsheets,
  onGetSheets,
  sheetsData,
  isLoadingSheets,
  onCreateConnection,
  isCreatingConnection,
}: SpreadsheetSelectorModalProps) {
  const [step, setStep] = useState<Step>("spreadsheets");
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<{ id: string; name: string } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [monthRange, setMonthRange] = useState<MonthRange>({ from: "", to: "" });
  const [detectedMonths, setDetectedMonths] = useState<Array<{ periodKey: string; label: string }>>([]);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [accumulatedSpreadsheets, setAccumulatedSpreadsheets] = useState<Spreadsheet[]>([]);
  const [currentNextPageToken, setCurrentNextPageToken] = useState<string | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadMoreRef = useRef(false);

  // When new data arrives, update accumulated list
  useEffect(() => {
    if (spreadsheets) {
      if (isLoadMoreRef.current) {
        // Append for pagination
        setAccumulatedSpreadsheets(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newItems = spreadsheets.filter(s => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
        isLoadMoreRef.current = false;
      } else {
        // Replace for fresh load / search
        setAccumulatedSpreadsheets(spreadsheets);
      }
      setCurrentNextPageToken(nextPageToken);
    }
  }, [spreadsheets, nextPageToken]);

  // Auto-load on open
  useEffect(() => {
    if (open && step === "spreadsheets") {
      setSearchTerm("");
      setAccumulatedSpreadsheets([]);
      isLoadMoreRef.current = false;
      onLoadSpreadsheets({});
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("spreadsheets");
      setSelectedSpreadsheet(null);
      setSelectedSheet(null);
      setMonthRange({ from: "", to: "" });
      setDetectedMonths([]);
      setSearchTerm("");
      setAccumulatedSpreadsheets([]);
      setCurrentNextPageToken(undefined);
    }
  }, [open]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isLoadMoreRef.current = false;
      onLoadSpreadsheets({ searchTerm: value || undefined });
    }, 400);
  }, [onLoadSpreadsheets]);

  const handleRefresh = useCallback(() => {
    isLoadMoreRef.current = false;
    onLoadSpreadsheets({ searchTerm: searchTerm || undefined });
  }, [onLoadSpreadsheets, searchTerm]);

  const handleLoadMore = useCallback(() => {
    if (currentNextPageToken) {
      isLoadMoreRef.current = true;
      onLoadSpreadsheets({ searchTerm: searchTerm || undefined, pageToken: currentNextPageToken });
    }
  }, [onLoadSpreadsheets, searchTerm, currentNextPageToken]);

  // Detect monthly tabs when sheetsData arrives
  useEffect(() => {
    if (sheetsData?.sheets) {
      const months: Array<{ periodKey: string; label: string; monthIndex: number; year: number }> = [];
      for (const sheet of sheetsData.sheets) {
        const detected = detectMonthFromTab(sheet.title);
        if (detected) {
          const pk = `${detected.year}-${String(detected.monthIndex).padStart(2, "0")}`;
          months.push({
            periodKey: pk,
            label: `${MONTH_LABELS[detected.monthIndex]} ${detected.year}`,
            monthIndex: detected.monthIndex,
            year: detected.year,
          });
        }
      }
      months.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
      setDetectedMonths(months);

      if (months.length > 0) {
        const startIdx = Math.max(0, months.length - 6);
        setMonthRange({
          from: months[startIdx].periodKey,
          to: months[months.length - 1].periodKey,
        });
      }
    }
  }, [sheetsData]);

  const handleSelectSpreadsheet = (spreadsheet: { id: string; name: string }) => {
    setSelectedSpreadsheet(spreadsheet);
    onGetSheets(spreadsheet.id);
    setStep("sheets");
  };

  const handleSelectSheet = (sheetName: string | null) => {
    setSelectedSheet(sheetName);
    if (sheetName === null) {
      setStep("month-range");
    } else {
      setStep("confirm");
    }
  };

  const handleConfirm = async () => {
    if (!selectedSpreadsheet) return;
    await onCreateConnection({
      spreadsheetId: selectedSpreadsheet.id,
      spreadsheetName: selectedSpreadsheet.name,
      sheetName: selectedSheet,
      monthRange: selectedSheet === null ? monthRange : undefined,
    });
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "sheets") {
      setStep("spreadsheets");
      setSelectedSpreadsheet(null);
    } else if (step === "month-range") {
      setStep("sheets");
      setSelectedSheet(null);
    } else if (step === "confirm") {
      if (selectedSheet === null) {
        setStep("month-range");
      } else {
        setStep("sheets");
        setSelectedSheet(null);
      }
    }
  };

  const displayedSpreadsheets = accumulatedSpreadsheets;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-premium">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {step === "spreadsheets" && "Selecionar Planilha"}
            {step === "sheets" && "Selecionar Aba"}
            {step === "month-range" && "Selecionar Período"}
            {step === "confirm" && "Confirmar Conexão"}
          </DialogTitle>
          <DialogDescription>
            {step === "spreadsheets" && "Escolha a planilha que deseja conectar."}
            {step === "sheets" && "Escolha a aba com os dados financeiros."}
            {step === "month-range" && "Selecione o intervalo de meses para importar transações."}
            {step === "confirm" && "Revise e confirme a conexão."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {/* Step: Spreadsheets */}
          {step === "spreadsheets" && (
            <div className="space-y-3">
              {/* Search + Refresh */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar planilha..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoadingSpreadsheets}
                  title="Recarregar lista"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoadingSpreadsheets && "animate-spin")} />
                </Button>
              </div>

              {/* Spreadsheet list */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {isLoadingSpreadsheets && displayedSpreadsheets.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : displayedSpreadsheets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma planilha encontrada.
                  </p>
                ) : (
                  <>
                    {displayedSpreadsheets.map((spreadsheet) => (
                      <button
                        key={spreadsheet.id}
                        onClick={() => handleSelectSpreadsheet(spreadsheet)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-xl",
                          "border border-border/50 hover:border-primary/50",
                          "hover:bg-accent/50 transition-all duration-200 text-left group"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Table className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                {spreadsheet.name}
                              </p>
                              {spreadsheet.shared && (
                                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 gap-1">
                                  <Users className="w-3 h-3" />
                                  Compartilhada
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {spreadsheet.owner && <span>{spreadsheet.owner}</span>}
                              {spreadsheet.owner && spreadsheet.modified_time && <span>•</span>}
                              {spreadsheet.modified_time && (
                                <span>{formatModifiedTime(spreadsheet.modified_time)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </button>
                    ))}

                    {/* Load more */}
                    {currentNextPageToken && (
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        onClick={handleLoadMore}
                        disabled={isLoadingSpreadsheets}
                      >
                        {isLoadingSpreadsheets ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Carregar mais
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step: Sheets */}
          {step === "sheets" && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground px-1">
                Planilha: <span className="font-medium text-foreground">{selectedSpreadsheet?.name}</span>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {isLoadingSheets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleSelectSheet(null)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl",
                        "border border-border/50 hover:border-primary/50",
                        "hover:bg-accent/50 transition-all duration-200 text-left group"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Table className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Todas as Abas</p>
                          <p className="text-xs text-muted-foreground">
                            Importar transações de abas mensais
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                    {sheetsData?.sheets.map((sheet) => (
                      <button
                        key={sheet.sheet_id}
                        onClick={() => handleSelectSheet(sheet.title)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-xl",
                          "border border-border/50 hover:border-primary/50",
                          "hover:bg-accent/50 transition-all duration-200 text-left group"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Table className="w-5 h-5 text-primary" />
                          </div>
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {sheet.title}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </>
                )}
              </div>
              <Button variant="outline" onClick={handleBack} className="w-full">
                Voltar
              </Button>
            </div>
          )}

          {/* Step: Month Range */}
          {step === "month-range" && (
            <div className="space-y-5">
              <div className="text-sm text-muted-foreground px-1">
                Planilha: <span className="font-medium text-foreground">{selectedSpreadsheet?.name}</span>
              </div>

              {detectedMonths.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma aba mensal detectada nesta planilha.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary" />
                        Mês inicial
                      </label>
                      <Select value={monthRange.from} onValueChange={(v) => setMonthRange(prev => ({ ...prev, from: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {detectedMonths.map((m) => (
                            <SelectItem key={m.periodKey} value={m.periodKey}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary" />
                        Mês final
                      </label>
                      <Select value={monthRange.to} onValueChange={(v) => setMonthRange(prev => ({ ...prev, to: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {detectedMonths.filter(m => m.periodKey >= monthRange.from).map((m) => (
                            <SelectItem key={m.periodKey} value={m.periodKey}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      A aba <strong>DRE</strong> será importada separadamente no menu DRE. Apenas abas mensais serão importadas como transações.
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {detectedMonths.length} aba(s) mensal(is) detectada(s) •{" "}
                    {detectedMonths.filter(m => m.periodKey >= monthRange.from && m.periodKey <= monthRange.to).length} selecionada(s)
                  </p>
                </>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!monthRange.from || !monthRange.to || detectedMonths.length === 0}
                  className="flex-1"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Planilha</p>
                    <p className="font-medium text-foreground">{selectedSpreadsheet?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aba</p>
                    <p className="font-medium text-foreground">{selectedSheet || "Todas as abas (mensais)"}</p>
                  </div>
                </div>
                {selectedSheet === null && monthRange.from && monthRange.to && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm text-muted-foreground">Período</p>
                      <p className="font-medium text-foreground">
                        {detectedMonths.find(m => m.periodKey === monthRange.from)?.label} → {detectedMonths.find(m => m.periodKey === monthRange.to)?.label}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedSheet === null
                  ? "O sistema importará transações das abas mensais selecionadas. A aba DRE será importada separadamente."
                  : "Ao confirmar, o sistema irá analisar sua planilha e detectar automaticamente as colunas de dados financeiros."}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Voltar
                </Button>
                <Button 
                  onClick={handleConfirm} 
                  disabled={isCreatingConnection}
                  className="flex-1 gap-2"
                >
                  {isCreatingConnection ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Conectar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
