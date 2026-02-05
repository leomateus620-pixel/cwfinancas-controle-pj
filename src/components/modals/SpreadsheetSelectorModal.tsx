import { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  ChevronRight, 
  Loader2, 
  Table,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseMutationResult } from "@tanstack/react-query";

interface Spreadsheet {
  id: string;
  name: string;
  modified_time: string;
  owner?: string;
}

interface Sheet {
  sheet_id: number;
  title: string;
  index: number;
}

interface SpreadsheetSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Props from parent hook
  spreadsheets: Spreadsheet[] | undefined;
  isLoadingSpreadsheets: boolean;
  onLoadSpreadsheets: () => void;
  onGetSheets: (spreadsheetId: string) => void;
  sheetsData: { spreadsheet_name: string; sheets: Sheet[] } | undefined;
  isLoadingSheets: boolean;
  onCreateConnection: (params: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetName: string | null;
  }) => Promise<void>;
  isCreatingConnection: boolean;
}

type Step = "spreadsheets" | "sheets" | "confirm";

export function SpreadsheetSelectorModal({ 
  open, 
  onOpenChange,
  spreadsheets,
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
  
  // Flag to prevent duplicate calls (handles StrictMode and re-renders)
  const hasLoadedRef = useRef(false);

  // Load spreadsheets when modal opens - with duplicate call prevention
  useEffect(() => {
    if (open && step === "spreadsheets" && !spreadsheets && !isLoadingSpreadsheets && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      onLoadSpreadsheets();
    }
  }, [open, step, spreadsheets, isLoadingSpreadsheets, onLoadSpreadsheets]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("spreadsheets");
      setSelectedSpreadsheet(null);
      setSelectedSheet(null);
      // Reset the load flag so it can load again next time
      hasLoadedRef.current = false;
    }
  }, [open]);

  const handleSelectSpreadsheet = (spreadsheet: { id: string; name: string }) => {
    setSelectedSpreadsheet(spreadsheet);
    onGetSheets(spreadsheet.id);
    setStep("sheets");
  };

  const handleSelectSheet = (sheetName: string | null) => {
    setSelectedSheet(sheetName);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selectedSpreadsheet) return;

    await onCreateConnection({
      spreadsheetId: selectedSpreadsheet.id,
      spreadsheetName: selectedSpreadsheet.name,
      sheetName: selectedSheet,
    });

    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "sheets") {
      setStep("spreadsheets");
      setSelectedSpreadsheet(null);
    } else if (step === "confirm") {
      setStep("sheets");
      setSelectedSheet(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-premium">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {step === "spreadsheets" && "Selecionar Planilha"}
            {step === "sheets" && "Selecionar Aba"}
            {step === "confirm" && "Confirmar Conexão"}
          </DialogTitle>
          <DialogDescription>
            {step === "spreadsheets" && "Escolha a planilha que deseja conectar."}
            {step === "sheets" && "Escolha a aba com os dados financeiros."}
            {step === "confirm" && "Revise e confirme a conexão."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {/* Step: Spreadsheets */}
          {step === "spreadsheets" && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {isLoadingSpreadsheets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : spreadsheets?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma planilha encontrada.
                </p>
              ) : (
                spreadsheets?.map((spreadsheet) => (
                  <button
                    key={spreadsheet.id}
                    onClick={() => handleSelectSpreadsheet(spreadsheet)}
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
                      <div>
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {spreadsheet.name}
                        </p>
                        {spreadsheet.owner && (
                          <p className="text-xs text-muted-foreground">
                            {spreadsheet.owner}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
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
                            Importar dados de todas as abas
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
                    <p className="font-medium text-foreground">{selectedSheet || "Todas as abas"}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Ao confirmar, o sistema irá analisar sua planilha e detectar automaticamente as colunas de dados financeiros.
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
