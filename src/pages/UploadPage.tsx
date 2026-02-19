import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FileUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type FlowState = "idle" | "uploading" | "previewing" | "selecting" | "importing" | "success" | "error";

interface TabPreview {
  title: string;
  route: "DRE_ONLY" | "MONTHLY_TRANSACTIONS" | "IGNORE";
  monthIndex?: number;
  periodKey?: string;
  rowCount?: number;
  headers: string[];
  preview_rows: string[][];
  mapping: Record<string, string>;
}

interface ImportResult {
  total_scanned: number;
  total_imported: number;
  total_skipped: number;
  total_errors: number;
  warnings: Array<{ tab: string; row: number; message: string }>;
  tab_summary: Array<{ tab: string; route: string; imported: number; skipped: number; errors: number }>;
}

export function UploadPage() {
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Preview state
  const [tabs, setTabs] = useState<TabPreview[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set());
  const [previewTab, setPreviewTab] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  // Import state
  const [fileId, setFileId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<Record<string, unknown>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const resetAll = () => {
    setFlowState("idle");
    setErrorMessage("");
    setUploadProgress(0);
    setTabs([]);
    setSelectedTabs(new Set());
    setPreviewTab(null);
    setFileName("");
    setFileId(null);
    setFilePath(null);
    setImportProgress({});
    setImportResult(null);
    setShowWarnings(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // ===== Step 1: Upload file to storage =====
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMessage("Selecione um arquivo Excel válido (.xlsx ou .xls)");
      setFlowState("error");
      return;
    }
    if (!user) return;

    setFlowState("uploading");
    setUploadProgress(10);
    setFileName(file.name);

    try {
      // Upload to storage
      const path = `${user.id}/${Date.now()}_${file.name}`;
      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("excel-uploads")
        .upload(path, file, { upsert: true });

      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);
      setUploadProgress(50);

      // Create uploaded_files record
      const { data: record, error: recordError } = await supabase
        .from("uploaded_files")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          status: "uploaded",
          rows_imported: 0,
        })
        .select()
        .single();

      if (recordError || !record) throw new Error("Falha ao registrar upload");
      setFileId(record.id);
      setFilePath(path);
      setUploadProgress(70);

      // Call Edge Function in preview mode
      setFlowState("previewing");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("parse-excel-upload", {
        body: {
          file_path: path,
          file_id: record.id,
          file_name: file.name,
          mode: "preview",
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (response.error) throw new Error(response.error.message || "Erro no preview");
      const result = response.data;
      if (!result?.success) throw new Error(result?.error || "Preview falhou");

      setTabs(result.tabs || []);
      // Auto-select monthly tabs
      const monthlyNames = new Set<string>(
        (result.tabs || [])
          .filter((t: TabPreview) => t.route === "MONTHLY_TRANSACTIONS")
          .map((t: TabPreview) => t.title)
      );
      setSelectedTabs(monthlyNames);

      // Set first monthly tab as preview
      const firstMonthly = (result.tabs || []).find((t: TabPreview) => t.route === "MONTHLY_TRANSACTIONS");
      if (firstMonthly) setPreviewTab(firstMonthly.title);

      setUploadProgress(100);
      setFlowState("selecting");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro inesperado");
      setFlowState("error");
    }
  }, [user]);

  // ===== Step 2: Import selected tabs =====
  const startImport = async () => {
    if (!fileId || !filePath || !user) return;

    setFlowState("importing");
    setImportProgress({});

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Start polling for progress
      pollingRef.current = setInterval(async () => {
        const { data } = await supabase
          .from("uploaded_files")
          .select("progress, status, warnings, tab_summary, rows_imported")
          .eq("id", fileId)
          .single();

        if (data) {
          const progress = data.progress as Record<string, unknown> | null;
          if (progress) setImportProgress(progress);

          if (data.status === "success" || data.status === "partial" || data.status === "error" || data.status === "timeout") {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      }, 1500);

      const response = await supabase.functions.invoke("parse-excel-upload", {
        body: {
          file_path: filePath,
          file_id: fileId,
          file_name: fileName,
          mode: "import",
          selected_tabs: Array.from(selectedTabs),
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (pollingRef.current) clearInterval(pollingRef.current);

      if (response.error) throw new Error(response.error.message || "Erro na importação");
      const result = response.data;

      if (!result?.success && !result?.total_imported) {
        throw new Error(result?.error || "Importação falhou");
      }

      setImportResult(result);
      setFlowState("success");

      toast({
        title: "Importação concluída!",
        description: `${result.total_imported} transações importadas de ${result.tab_summary?.length || 0} abas.`,
      });
    } catch (err) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setErrorMessage(err instanceof Error ? err.message : "Erro na importação");
      setFlowState("error");
    }
  };

  const toggleTab = (title: string) => {
    setSelectedTabs(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const progressPercent = (() => {
    const p = importProgress as { tabs_total?: number; tabs_done?: number; rows_read?: number; rows_imported?: number };
    if (!p.tabs_total) return 0;
    return Math.round(((p.tabs_done || 0) / p.tabs_total) * 100);
  })();

  const currentPreviewTab = tabs.find(t => t.title === previewTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
          <FileUp className="w-7 h-7 text-primary" />
          Upload de Dados
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe seus dados financeiros de arquivos Excel (.xlsx / .xls).
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Upload de Excel
          </CardTitle>
          <CardDescription>
            Arraste e solte ou clique para selecionar. O processamento é feito no servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* IDLE */}
          {flowState === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", isDragging ? "bg-primary/20" : "bg-primary/10")}>
                    <Upload className={cn("w-8 h-8", isDragging ? "text-primary" : "text-primary/80")} />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">{isDragging ? "Solte o arquivo aqui" : "Arraste seu arquivo Excel aqui"}</p>
                    <p className="text-sm text-muted-foreground mt-1">Suporta .xlsx e .xls até 20MB</p>
                  </div>
                  <Button variant="outline" className="mt-2">Selecionar Arquivo</Button>
                </div>
              </label>
            </div>
          )}

          {/* UPLOADING / PREVIEWING */}
          {(flowState === "uploading" || flowState === "previewing") && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-foreground font-medium mb-4">
                {flowState === "uploading" ? "Enviando arquivo..." : "Analisando planilha no servidor..."}
              </p>
              <Progress value={uploadProgress} className="max-w-xs mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">{uploadProgress.toFixed(0)}%</p>
            </div>
          )}

          {/* IMPORTING */}
          {flowState === "importing" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <p className="text-foreground font-medium mb-2">Importando dados...</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(importProgress as Record<string, unknown>).current_tab
                  ? `Aba: ${(importProgress as Record<string, unknown>).current_tab}`
                  : "Preparando..."}
              </p>
              <Progress value={progressPercent} className="max-w-xs mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">
                {String((importProgress as Record<string, unknown>).tabs_done ?? 0)}/{String((importProgress as Record<string, unknown>).tabs_total ?? "?")} abas •{" "}
                {String((importProgress as Record<string, unknown>).rows_imported ?? 0)} linhas importadas
              </p>
            </div>
          )}

          {/* ERROR */}
          {flowState === "error" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-foreground font-medium mb-2">Erro</p>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
              <Button onClick={resetAll}>Tentar Novamente</Button>
            </div>
          )}

          {/* SUCCESS */}
          {flowState === "success" && importResult && (
            <div className="space-y-6">
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <p className="text-foreground font-medium mb-2">Importação Concluída!</p>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{importResult.total_imported}</p>
                    <p className="text-xs text-muted-foreground">Importadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{importResult.total_skipped}</p>
                    <p className="text-xs text-muted-foreground">Ignoradas</p>
                  </div>
                  {importResult.total_errors > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">{importResult.total_errors}</p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab summary */}
              {importResult.tab_summary && importResult.tab_summary.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aba</TableHead>
                        <TableHead className="text-right">Importadas</TableHead>
                        <TableHead className="text-right">Ignoradas</TableHead>
                        <TableHead className="text-right">Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.tab_summary.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.tab}</TableCell>
                          <TableCell className="text-right">{s.imported}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{s.skipped}</TableCell>
                          <TableCell className="text-right text-destructive">{s.errors}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings && importResult.warnings.length > 0 && (
                <Collapsible open={showWarnings} onOpenChange={setShowWarnings}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="text-sm text-muted-foreground">
                        {importResult.warnings.length} avisos
                      </span>
                      {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="max-h-60 overflow-auto rounded-lg border border-border p-3 space-y-1">
                      {importResult.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium">{w.tab}</span> linha {w.row}: {w.message}
                        </p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="text-center">
                <Button onClick={resetAll}>Importar Novo Arquivo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Selection */}
      {flowState === "selecting" && tabs.length > 0 && (
        <>
          <Card className="border-border/50 shadow-premium-sm">
            <CardHeader>
              <CardTitle>Seleção de Abas</CardTitle>
              <CardDescription>
                {fileName} — {tabs.length} abas detectadas. Selecione quais importar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tabs.map(tab => {
                  const isSelected = selectedTabs.has(tab.title);
                  const isMonthly = tab.route === "MONTHLY_TRANSACTIONS";
                  const isDre = tab.route === "DRE_ONLY";
                  const isIgnored = tab.route === "IGNORE";

                  return (
                    <div
                      key={tab.title}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                        isSelected ? "border-primary/50 bg-primary/5" : "border-border",
                        isIgnored && "opacity-50",
                      )}
                      onClick={() => {
                        if (!isIgnored) toggleTab(tab.title);
                        setPreviewTab(tab.title);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={isIgnored}
                          onCheckedChange={() => toggleTab(tab.title)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <span className="font-medium text-foreground">{tab.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {(tab.rowCount || 0) - 1} linhas
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMonthly && <Badge variant="secondary">{tab.periodKey}</Badge>}
                        {isDre && <Badge variant="secondary" className="border-accent">DRE</Badge>}
                        {isIgnored && <Badge variant="outline" className="text-muted-foreground">Ignorada</Badge>}
                        {Object.keys(tab.mapping || {}).length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {Object.keys(tab.mapping).filter(k => k !== "account").join(", ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-6">
                <Button variant="outline" onClick={resetAll}>Cancelar</Button>
                <Button onClick={startImport} disabled={selectedTabs.size === 0}>
                  Importar {selectedTabs.size} aba{selectedTabs.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview Table */}
          {currentPreviewTab && currentPreviewTab.headers.length > 0 && (
            <Card className="border-border/50 shadow-premium-sm">
              <CardHeader>
                <CardTitle className="text-base">Preview: {currentPreviewTab.title}</CardTitle>
                <CardDescription>
                  Mapeamento detectado:{" "}
                  {Object.entries(currentPreviewTab.mapping || {}).map(([k, v]) => (
                    <span key={k} className="inline-block mr-2">
                      <span className="font-medium">{k}</span>→<span className="text-primary">{v}</span>
                    </span>
                  ))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-80 rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {currentPreviewTab.headers.map((h, i) => (
                          <TableHead key={i} className="text-xs whitespace-nowrap">{h || `Col ${i + 1}`}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentPreviewTab.preview_rows.map((row, ri) => (
                        <TableRow key={ri}>
                          {row.map((cell, ci) => (
                            <TableCell key={ci} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
