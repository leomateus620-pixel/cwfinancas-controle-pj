import { useState, useCallback, useRef, useEffect } from "react";
import { FileDown, Upload, FileText, Trash2, RefreshCw, Download, AlertCircle, CheckCircle2, Loader2, CreditCard, Landmark, HelpCircle, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type DocType = "bank" | "credit_card" | "unknown";
type UploadStatus = "uploading" | "processing" | "done" | "error";

interface ParsedTransaction {
  date: string | null;
  description: string;
  amount: number;
  original_amount: number;
  row_index: number;
}

interface UploadEntry {
  id: string;
  file_name: string;
  detected_type: DocType;
  status: UploadStatus;
  error_message: string | null;
  transactions: ParsedTransaction[];
  ocr_used?: boolean;
  stats?: { total_lines: number; valid_transactions: number; skipped: number };
}

const typeLabels: Record<DocType, { label: string; icon: React.ElementType; colorClass: string; badgeClass: string }> = {
  bank: { label: "Extrato Bancário", icon: Landmark, colorClass: "text-emerald-600 dark:text-emerald-400", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30" },
  credit_card: { label: "Cartão de Crédito", icon: CreditCard, colorClass: "text-violet-600 dark:text-violet-400", badgeClass: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30" },
  unknown: { label: "Não identificado", icon: HelpCircle, colorClass: "text-amber-600 dark:text-amber-400", badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30" },
};

const statusConfig: Record<UploadStatus, { label: string; badgeClass: string }> = {
  uploading: { label: "Enviando...", badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30" },
  processing: { label: "Processando...", badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  done: { label: "Concluído", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  error: { label: "Erro", badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" },
};

export default function StatementConverterPage() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUpload = uploads.find((u) => u.id === selectedUploadId);

  // ── Load history on mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingHistory(false); return; }

      const { data: uploadRows } = await supabase
        .from("pdf_statement_uploads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!uploadRows || uploadRows.length === 0) { setLoadingHistory(false); return; }

      const entries: UploadEntry[] = [];
      for (const row of uploadRows) {
        let transactions: ParsedTransaction[] = [];
        if (row.status === "done" && (row.transaction_count ?? 0) > 0) {
          const { data: txns } = await supabase
            .from("pdf_parsed_transactions")
            .select("*")
            .eq("upload_id", row.id)
            .order("row_index", { ascending: true });
          if (txns) {
            transactions = txns.map((t) => ({
              date: t.date,
              description: t.description,
              amount: t.amount,
              original_amount: t.original_amount ?? t.amount,
              row_index: t.row_index,
            }));
          }
        }
        entries.push({
          id: row.id,
          file_name: row.file_name,
          detected_type: (row.detected_type as DocType) || "unknown",
          status: row.status as UploadStatus,
          error_message: row.error_message,
          transactions,
        });
      }

      setUploads(entries);
      if (entries.length > 0 && entries[0].status === "done") {
        setSelectedUploadId(entries[0].id);
      }
      setLoadingHistory(false);
    })();
  }, []);

  // ── Process file ───────────────────────────────────────────
  const processFile = useCallback(async (file: File, manualType?: DocType) => {
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls") ||
      file.type.includes("spreadsheetml") || file.type.includes("ms-excel");
    if (!isPdf && !isExcel) {
      toast.error("Apenas arquivos PDF, XLS ou XLSX são aceitos");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }

    const { data: uploadRow, error: insertErr } = await supabase
      .from("pdf_statement_uploads")
      .insert({ user_id: user.id, file_name: file.name, file_size: file.size, status: "uploading" })
      .select("id")
      .single();

    if (insertErr || !uploadRow) {
      toast.error("Erro ao registrar upload");
      return;
    }

    const entry: UploadEntry = {
      id: uploadRow.id,
      file_name: file.name,
      detected_type: "unknown",
      status: "uploading",
      error_message: null,
      transactions: [],
    };

    setUploads((prev) => [entry, ...prev]);
    setSelectedUploadId(uploadRow.id);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_id", uploadRow.id);
    if (manualType) formData.append("manual_type", manualType);

    try {
      setUploads((prev) => prev.map((u) => u.id === uploadRow.id ? { ...u, status: "processing" } : u));

      const { data: session } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-pdf-statement`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
          body: formData,
        }
      );

      const result = await resp.json();

      if (!resp.ok) {
        setUploads((prev) =>
          prev.map((u) => u.id === uploadRow.id
            ? { ...u, status: "error", error_message: result.error || "Erro no processamento" }
            : u
          )
        );
        toast.error(result.error || "Erro ao processar PDF");
        return;
      }

      setUploads((prev) =>
        prev.map((u) => u.id === uploadRow.id
          ? {
              ...u,
              status: "done",
              detected_type: result.detected_type,
              transactions: result.transactions || [],
              ocr_used: result.ocr_used,
              stats: result.stats,
            }
          : u
        )
      );

      const method = result.ocr_used ? " (via OCR inteligente)" : "";
      toast.success(`${result.stats?.valid_transactions || 0} transações extraídas${method}!`);
    } catch {
      setUploads((prev) =>
        prev.map((u) => u.id === uploadRow.id ? { ...u, status: "error", error_message: "Falha na conexão" } : u)
      );
      toast.error("Falha na conexão com o servidor");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach((f) => processFile(f));
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((f) => processFile(f));
    e.target.value = "";
  }, [processFile]);

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from("pdf_parsed_transactions").delete().eq("upload_id", id);
    await supabase.from("pdf_statement_uploads").delete().eq("id", id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
    if (selectedUploadId === id) setSelectedUploadId(null);
    toast.success("Arquivo removido");
  }, [selectedUploadId]);

  const handleSetManualType = useCallback(async (uploadId: string, type: DocType) => {
    await supabase.from("pdf_statement_uploads").update({ manual_type: type }).eq("id", uploadId);
    setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, detected_type: type } : u));
    toast.success(`Tipo alterado para ${typeLabels[type].label}`);
  }, []);

  // ── Export ─────────────────────────────────────────────────
  const exportCSV = useCallback((upload: UploadEntry) => {
    const isCreditCard = upload.detected_type === "credit_card";
    const header = isCreditCard ? "Descrição;Valor" : "Data;Descrição;Valor";
    const rows = upload.transactions
      .filter((t) => t.description.length > 0)
      .map((t) => {
        const val = t.amount.toFixed(2).replace(".", ",");
        return isCreditCard ? `"${t.description}";${val}` : `${t.date || ""};"${t.description}";${val}`;
      });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = upload.file_name.replace(".pdf", "") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  }, []);

  const exportExcel = useCallback((upload: UploadEntry) => {
    const isCreditCard = upload.detected_type === "credit_card";
    const data = upload.transactions
      .filter((t) => t.description.length > 0)
      .map((t) => isCreditCard
        ? { "Descrição": t.description, "Valor": t.amount }
        : { "Data": t.date || "", "Descrição": t.description, "Valor": t.amount }
      );

    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    XLSX.writeFile(wb, upload.file_name.replace(".pdf", "") + ".xlsx");
    toast.success("Excel exportado!");
  }, []);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto relative">
      {/* Decorative orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-48 w-80 h-80 bg-violet-500/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* ── Hero Header ─────────────────────────────────── */}
      <div className="liquid-glass-caixa p-6 md:p-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <FileDown className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Conversor de Extratos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Converta PDFs de extratos bancários e faturas de cartão em CSV ou Excel
            </p>
          </div>
        </div>
      </div>

      {/* ── Upload Zone ──────────────────────────────────── */}
      <div
        className={`liquid-glass relative rounded-2xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 z-10 ${
          isDragging ? "scale-[1.01] ring-2 ring-primary/30 border-primary/40" : ""
        }`}
        style={{ minHeight: "180px", borderStyle: "dashed", borderWidth: "2px" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple className="hidden" onChange={handleFileChange} />
        <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
          <Upload className={`w-8 h-8 ${isDragging ? "text-primary animate-bounce" : "text-primary/70"}`} />
        </div>
        <div className="text-center">
          <p className="text-foreground/80 font-medium">Arraste seu PDF ou Excel aqui ou clique para selecionar</p>
          <p className="text-muted-foreground text-sm mt-1">Aceita PDF, XLS e XLSX (extratos bancários e faturas de cartão)</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
          <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <Landmark className="w-3 h-3" /> Bancário
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400">
            <CreditCard className="w-3 h-3" /> Cartão
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400">
            <FileText className="w-3 h-3" /> Excel
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-3 h-3" /> OCR Inteligente
          </Badge>
        </div>
      </div>

      {/* ── Loading History ───────────────────────────────── */}
      {loadingHistory && (
        <div className="liquid-glass-compact p-6 flex items-center justify-center gap-3 z-10 relative">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando histórico...</span>
        </div>
      )}

      {/* ── File List ────────────────────────────────────── */}
      {uploads.length > 0 && (
        <div className="space-y-3 relative z-10">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Arquivos enviados ({uploads.length})
          </h2>
          <div className="space-y-2">
            {uploads.map((u) => {
              const typeInfo = typeLabels[u.detected_type];
              const statusInfo = statusConfig[u.status];
              const TypeIcon = typeInfo.icon;
              const isSelected = selectedUploadId === u.id;
              const isLoading = u.status === "uploading" || u.status === "processing";

              return (
                <div
                  key={u.id}
                  className={`liquid-glass-compact p-4 transition-all duration-200 cursor-pointer ${
                    isSelected ? "ring-2 ring-primary/30 shadow-lg" : "hover:shadow-md"
                  }`}
                  onClick={() => u.status === "done" && setSelectedUploadId(u.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isLoading ? (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        </div>
                      ) : u.status === "error" ? (
                        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        </div>
                      ) : (
                        <div className={`p-2 rounded-lg ${
                          u.detected_type === "bank" ? "bg-emerald-500/10 border border-emerald-500/20" :
                          u.detected_type === "credit_card" ? "bg-violet-500/10 border border-violet-500/20" :
                          "bg-amber-500/10 border border-amber-500/20"
                        }`}>
                          <TypeIcon className={`w-4 h-4 ${typeInfo.colorClass}`} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-medium truncate">{u.file_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 ${statusInfo.badgeClass}`}>
                            {isLoading && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                            {statusInfo.label}
                          </Badge>
                          {u.status === "done" && (
                            <>
                              <Badge variant="outline" className={`text-[10px] px-2 py-0 ${typeInfo.badgeClass}`}>
                                {typeInfo.label}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                {u.transactions.length} transações
                              </span>
                              {u.ocr_used && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                  <Sparkles className="w-2.5 h-2.5 mr-1" /> OCR
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        {u.error_message && (
                          <p className="text-[11px] text-destructive/80 mt-1">{u.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.status === "done" && u.detected_type === "unknown" && (
                        <div className="flex gap-1 mr-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={(e) => { e.stopPropagation(); handleSetManualType(u.id, "bank"); }}>
                            Bancário
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                            onClick={(e) => { e.stopPropagation(); handleSetManualType(u.id, "credit_card"); }}>
                            Cartão
                          </Button>
                        </div>
                      )}
                      {u.status === "done" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setSelectedUploadId(u.id); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Preview + Export ──────────────────────────────── */}
      {selectedUpload && selectedUpload.status === "done" && selectedUpload.transactions.length > 0 && (
        <div className="liquid-glass-caixa overflow-hidden relative z-10">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">Pré-visualização</p>
                <p className="text-muted-foreground text-[11px]">
                  {selectedUpload.transactions.length} transações · {selectedUpload.file_name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => exportCSV(selectedUpload)}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => exportExcel(selectedUpload)}>
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  {selectedUpload.detected_type !== "credit_card" && (
                    <TableHead className="text-muted-foreground text-xs font-semibold bg-muted/20">Data</TableHead>
                  )}
                  <TableHead className="text-muted-foreground text-xs font-semibold bg-muted/20">Descrição</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold text-right bg-muted/20">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedUpload.transactions.map((t, i) => (
                  <TableRow key={i} className="border-border/30 hover:bg-muted/10">
                    {selectedUpload.detected_type !== "credit_card" && (
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap font-mono">{t.date}</TableCell>
                    )}
                    <TableCell className="text-foreground/90 text-xs">{t.description}</TableCell>
                    <TableCell className={`text-xs text-right font-mono whitespace-nowrap ${
                      t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedUpload.stats && (
            <div className="flex items-center gap-4 p-3 border-t border-border/40 text-[11px] text-muted-foreground">
              <span>{selectedUpload.stats.total_lines} linhas lidas</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{selectedUpload.stats.valid_transactions} transações válidas</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{selectedUpload.stats.skipped} linhas ignoradas</span>
              {selectedUpload.ocr_used && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-3 h-3" /> Processado via OCR
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loadingHistory && uploads.length === 0 && (
        <div className="liquid-glass p-12 flex flex-col items-center gap-4 text-center relative z-10">
          <div className="p-4 rounded-full bg-muted/30">
            <FileText className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-foreground/70 font-medium">Nenhum extrato convertido ainda</p>
            <p className="text-muted-foreground text-sm mt-1">
              Envie um PDF de extrato bancário ou fatura de cartão para começar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
