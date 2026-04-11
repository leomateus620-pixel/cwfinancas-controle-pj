import { useState, useCallback, useRef } from "react";
import { FileDown, Upload, FileText, Trash2, RefreshCw, Download, AlertCircle, CheckCircle2, Loader2, CreditCard, Landmark, HelpCircle } from "lucide-react";
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
  stats?: { total_lines: number; valid_transactions: number; skipped: number };
}

const typeLabels: Record<DocType, { label: string; icon: React.ElementType; color: string }> = {
  bank: { label: "Extrato Bancário", icon: Landmark, color: "text-emerald-400" },
  credit_card: { label: "Cartão de Crédito", icon: CreditCard, color: "text-violet-400" },
  unknown: { label: "Não identificado", icon: HelpCircle, color: "text-amber-400" },
};

const statusConfig: Record<UploadStatus, { label: string; color: string }> = {
  uploading: { label: "Enviando...", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  processing: { label: "Processando...", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  done: { label: "Concluído", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  error: { label: "Erro", color: "bg-red-500/20 text-red-300 border-red-500/30" },
};

export default function StatementConverterPage() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUpload = uploads.find((u) => u.id === selectedUploadId);

  const processFile = useCallback(async (file: File, manualType?: DocType) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }

    // Create upload record
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

    // Send to edge function
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
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
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
              stats: result.stats,
            }
          : u
        )
      );
      toast.success(`${result.stats?.valid_transactions || 0} transações extraídas!`);
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) => u.id === uploadRow.id ? { ...u, status: "error", error_message: "Falha na conexão" } : u)
      );
      toast.error("Falha na conexão com o servidor");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => processFile(f));
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => processFile(f));
    e.target.value = "";
  }, [processFile]);

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from("pdf_parsed_transactions").delete().eq("upload_id", id);
    await supabase.from("pdf_statement_uploads").delete().eq("id", id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
    if (selectedUploadId === id) setSelectedUploadId(null);
    toast.success("Arquivo removido");
  }, [selectedUploadId]);

  const handleReprocess = useCallback(async (upload: UploadEntry) => {
    // Delete old transactions then re-upload would need the file again
    toast.info("Para reprocessar, envie o arquivo novamente");
    await handleDelete(upload.id);
  }, [handleDelete]);

  const handleSetManualType = useCallback(async (uploadId: string, type: DocType) => {
    // Find the entry to get the file name - we'd need the file again
    // For now, update the type in DB and let the user re-upload if needed
    await supabase.from("pdf_statement_uploads").update({ manual_type: type }).eq("id", uploadId);
    setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, detected_type: type } : u));
    toast.success(`Tipo alterado para ${typeLabels[type].label}`);
  }, []);

  // ── Export helpers ──────────────────────────────────────────
  const exportCSV = useCallback((upload: UploadEntry) => {
    const isCreditCard = upload.detected_type === "credit_card";
    const header = isCreditCard ? "Descrição;Valor" : "Data;Descrição;Valor";
    const rows = upload.transactions
      .filter((t) => t.description.length > 0)
      .map((t) => {
        const val = t.amount.toFixed(2).replace(".", ",");
        return isCreditCard
          ? `"${t.description}";${val}`
          : `${t.date || ""};"${t.description}";${val}`;
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
      .map((t) => {
        if (isCreditCard) {
          return { "Descrição": t.description, "Valor": t.amount };
        }
        return { "Data": t.date || "", "Descrição": t.description, "Valor": t.amount };
      });

    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-width
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
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.75) 50%, rgba(15,23,42,0.9) 100%)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl" style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))",
            border: "1px solid rgba(139,92,246,0.3)",
          }}>
            <FileDown className="w-7 h-7 text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Conversor de Extratos
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Converta PDFs de extratos bancários e faturas de cartão em CSV ou Excel
            </p>
          </div>
        </div>
      </div>

      {/* ── Upload Zone ──────────────────────────────────── */}
      <div
        className={`relative rounded-2xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 ${isDragging ? "scale-[1.01]" : ""}`}
        style={{
          background: isDragging
            ? "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))"
            : "linear-gradient(135deg, rgba(15,23,42,0.6), rgba(30,41,59,0.4))",
          backdropFilter: "blur(16px)",
          border: isDragging ? "2px dashed rgba(139,92,246,0.5)" : "2px dashed rgba(255,255,255,0.1)",
          boxShadow: isDragging
            ? "0 0 30px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "inset 0 1px 0 rgba(255,255,255,0.03)",
          minHeight: "180px",
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={handleFileChange} />
        <div className="p-4 rounded-full" style={{
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.2)",
        }}>
          <Upload className="w-8 h-8 text-violet-300" />
        </div>
        <div className="text-center">
          <p className="text-white/80 font-medium">Arraste seu PDF aqui ou clique para selecionar</p>
          <p className="text-white/35 text-sm mt-1">Aceita extratos bancários e faturas de cartão de crédito</p>
        </div>
      </div>

      {/* ── File List ────────────────────────────────────── */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider px-1">Arquivos enviados</h2>
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
                  className={`rounded-xl p-4 transition-all duration-200 cursor-pointer ${isSelected ? "ring-1 ring-violet-500/40" : ""}`}
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(30,41,59,0.6))"
                      : "rgba(15,23,42,0.5)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${isSelected ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}
                  onClick={() => u.status === "done" && setSelectedUploadId(u.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 text-violet-400 animate-spin shrink-0" />
                      ) : u.status === "error" ? (
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                      ) : (
                        <TypeIcon className={`w-5 h-5 shrink-0 ${typeInfo.color}`} />
                      )}
                      <div className="min-w-0">
                        <p className="text-white/90 text-sm font-medium truncate">{u.file_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                          {u.status === "done" && (
                            <span className="text-[11px] text-white/35">
                              {u.transactions.length} transações · {typeInfo.label}
                            </span>
                          )}
                        </div>
                        {u.error_message && (
                          <p className="text-[11px] text-red-400/80 mt-1">{u.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.status === "done" && u.detected_type === "unknown" && (
                        <div className="flex gap-1 mr-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300"
                            onClick={(e) => { e.stopPropagation(); handleSetManualType(u.id, "bank"); }}>
                            Bancário
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-violet-400 hover:text-violet-300"
                            onClick={(e) => { e.stopPropagation(); handleSetManualType(u.id, "credit_card"); }}>
                            Cartão
                          </Button>
                        </div>
                      )}
                      {u.status === "error" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white/70"
                          onClick={(e) => { e.stopPropagation(); handleReprocess(u); }}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-white/30 hover:text-red-400"
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
        <div className="rounded-2xl overflow-hidden" style={{
          background: "rgba(15,23,42,0.6)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-violet-300" />
              <div>
                <p className="text-white/90 text-sm font-medium">Pré-visualização</p>
                <p className="text-white/35 text-[11px]">{selectedUpload.transactions.length} transações extraídas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => exportCSV(selectedUpload)}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button size="sm"
                className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white"
                onClick={() => exportExcel(selectedUpload)}>
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  {selectedUpload.detected_type !== "credit_card" && (
                    <TableHead className="text-white/50 text-xs font-semibold">Data</TableHead>
                  )}
                  <TableHead className="text-white/50 text-xs font-semibold">Descrição</TableHead>
                  <TableHead className="text-white/50 text-xs font-semibold text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedUpload.transactions.map((t, i) => (
                  <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                    {selectedUpload.detected_type !== "credit_card" && (
                      <TableCell className="text-white/60 text-xs whitespace-nowrap font-mono">{t.date}</TableCell>
                    )}
                    <TableCell className="text-white/80 text-xs">{t.description}</TableCell>
                    <TableCell className={`text-xs text-right font-mono whitespace-nowrap ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedUpload.stats && (
            <div className="flex items-center gap-4 p-3 border-t border-white/[0.06] text-[11px] text-white/30">
              <span>{selectedUpload.stats.total_lines} linhas lidas</span>
              <span>{selectedUpload.stats.valid_transactions} transações válidas</span>
              <span>{selectedUpload.stats.skipped} linhas ignoradas</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
