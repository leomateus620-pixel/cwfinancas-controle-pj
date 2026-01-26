import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Eye, FileUp, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedData {
  headers: string[];
  rows: any[][];
  fileName: string;
}

interface ColumnMapping {
  type: number | null;
  description: number | null;
  amount: number | null;
  category: number | null;
  date: number | null;
  client_vendor: number | null;
}

const defaultMapping: ColumnMapping = {
  type: null,
  description: null,
  amount: null,
  category: null,
  date: null,
  client_vendor: null,
};

export function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "parsing" | "mapping" | "importing" | "success" | "error">("idle");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultMapping);
  const [importProgress, setImportProgress] = useState(0);

  const { user } = useAuth();
  const { createTransaction } = useTransactions();
  const { toast } = useToast();

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMessage("Por favor, selecione um arquivo Excel válido (.xlsx ou .xls)");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("parsing");
    setUploadProgress(0);

    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 50);
      }
    };

    reader.onload = (e) => {
      try {
        setUploadProgress(60);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        setUploadProgress(80);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          throw new Error("O arquivo precisa ter pelo menos uma linha de cabeçalho e uma linha de dados");
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ""));

        setUploadProgress(100);
        setParsedData({ headers, rows, fileName: file.name });
        setColumnMapping(defaultMapping);
        setUploadStatus("mapping");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao processar arquivo");
        setUploadStatus("error");
      }
    };

    reader.onerror = () => {
      setErrorMessage("Erro ao ler o arquivo");
      setUploadStatus("error");
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const resetUpload = () => {
    setUploadStatus("idle");
    setParsedData(null);
    setErrorMessage("");
    setUploadProgress(0);
    setColumnMapping(defaultMapping);
    setImportProgress(0);
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === "none" ? null : parseInt(value, 10),
    }));
  };

  const isValidMapping = () => {
    return (
      columnMapping.description !== null &&
      columnMapping.amount !== null &&
      columnMapping.date !== null
    );
  };

  const parseExcelDate = (value: any): string => {
    if (typeof value === "number") {
      // Excel serial date
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    if (typeof value === "string") {
      // Try to parse as date string
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
      // Try DD/MM/YYYY format
      const parts = value.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    return new Date().toISOString().split("T")[0];
  };

  const importData = async () => {
    if (!parsedData || !user) return;

    setUploadStatus("importing");
    setImportProgress(0);

    try {
      // Record the upload in uploaded_files
      const { data: uploadRecord, error: uploadError } = await supabase
        .from("uploaded_files")
        .insert({
          user_id: user.id,
          file_name: parsedData.fileName,
          status: "processing",
          rows_imported: 0,
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      let successCount = 0;
      const totalRows = parsedData.rows.length;

      // Import transactions in batches
      const batchSize = 50;
      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = parsedData.rows.slice(i, i + batchSize);
        
        const transactions = batch.map(row => {
          const rawAmount = columnMapping.amount !== null ? row[columnMapping.amount] : 0;
          const amount = Math.abs(parseFloat(String(rawAmount).replace(/[^\d.-]/g, "")) || 0);
          
          // Determine type based on type column or amount sign
          let type: "income" | "expense" = "expense";
          if (columnMapping.type !== null) {
            const typeValue = String(row[columnMapping.type]).toLowerCase();
            type = typeValue.includes("receita") || typeValue.includes("entrada") || typeValue.includes("income") 
              ? "income" 
              : "expense";
          } else if (rawAmount && parseFloat(String(rawAmount).replace(/[^\d.-]/g, "")) > 0) {
            type = "income";
          }

          return {
            user_id: user.id,
            type,
            description: columnMapping.description !== null ? String(row[columnMapping.description] || "Sem descrição") : "Sem descrição",
            amount,
            category: columnMapping.category !== null ? String(row[columnMapping.category] || "Outros") : "Outros",
            date: columnMapping.date !== null ? parseExcelDate(row[columnMapping.date]) : new Date().toISOString().split("T")[0],
            client_vendor: columnMapping.client_vendor !== null ? String(row[columnMapping.client_vendor] || null) : null,
          };
        }).filter(t => t.amount > 0);

        if (transactions.length > 0) {
          const { error: insertError } = await supabase
            .from("transactions")
            .insert(transactions);

          if (insertError) throw insertError;
          successCount += transactions.length;
        }

        setImportProgress(Math.round(((i + batch.length) / totalRows) * 100));
      }

      // Update upload record
      await supabase
        .from("uploaded_files")
        .update({
          status: "success",
          rows_imported: successCount,
        })
        .eq("id", uploadRecord.id);

      setUploadStatus("success");
      toast({
        title: "Dados importados com sucesso!",
        description: `${successCount} transações foram adicionadas ao sistema.`,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao importar dados");
      setUploadStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
          <FileUp className="w-7 h-7 text-primary" />
          Upload de Dados
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe seus dados financeiros de arquivos Excel.
        </p>
      </div>
      
      {/* Área de Upload */}
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Upload de Excel
          </CardTitle>
          <CardDescription>
            Arraste e solte seus arquivos .xlsx ou clique para selecionar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadStatus === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center transition-premium cursor-pointer",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-premium",
                    isDragging ? "bg-primary/20" : "bg-primary/10"
                  )}>
                    <Upload className={cn("w-8 h-8", isDragging ? "text-primary" : "text-primary/80")} />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      {isDragging ? "Solte o arquivo aqui" : "Arraste seu arquivo Excel aqui"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Suporta arquivos .xlsx e .xls até 10MB
                    </p>
                  </div>
                  <Button variant="outline" className="mt-2">Selecionar Arquivo</Button>
                </div>
              </label>
            </div>
          )}

          {uploadStatus === "parsing" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-foreground font-medium mb-4">Processando arquivo...</p>
              <Progress value={uploadProgress} className="max-w-xs mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">{uploadProgress.toFixed(0)}%</p>
            </div>
          )}

          {uploadStatus === "importing" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <p className="text-foreground font-medium mb-4">Importando dados...</p>
              <Progress value={importProgress} className="max-w-xs mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">{importProgress}%</p>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-foreground font-medium mb-2">Erro no Upload</p>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
              <Button onClick={resetUpload}>Tentar Novamente</Button>
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <p className="text-foreground font-medium mb-2">Dados Importados com Sucesso!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Seus dados estão disponíveis no dashboard.
              </p>
              <Button onClick={resetUpload}>Importar Novo Arquivo</Button>
            </div>
          )}

          {uploadStatus === "mapping" && parsedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{parsedData.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {parsedData.rows.length} linhas • {parsedData.headers.length} colunas
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetUpload}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapeamento de Colunas */}
      {parsedData && uploadStatus === "mapping" && (
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>
              Selecione quais colunas do arquivo correspondem a cada campo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Select onValueChange={(v) => handleMappingChange("description", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor *</Label>
                <Select onValueChange={(v) => handleMappingChange("amount", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data *</Label>
                <Select onValueChange={(v) => handleMappingChange("date", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo (Receita/Despesa)</Label>
                <Select onValueChange={(v) => handleMappingChange("type", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Automático (pelo valor)</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => handleMappingChange("category", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (usar "Outros")</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cliente/Fornecedor</Label>
                <Select onValueChange={(v) => handleMappingChange("client_vendor", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {parsedData.headers.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>{header || `Coluna ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetUpload}>Cancelar</Button>
              <Button onClick={importData} disabled={!isValidMapping()} className="gap-2">
                <Save className="w-4 h-4" />
                Importar {parsedData.rows.length} Linhas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview dos Dados */}
      {parsedData && uploadStatus === "mapping" && (
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Preview dos Dados
            </CardTitle>
            <CardDescription>
              Primeiras 10 linhas do arquivo importado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {parsedData.headers.map((header, i) => (
                      <TableHead key={i} className="whitespace-nowrap">{header || `Coluna ${i + 1}`}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.rows.slice(0, 10).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {parsedData.headers.map((_, colIndex) => (
                        <TableCell key={colIndex} className="whitespace-nowrap">
                          {row[colIndex] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.rows.length > 10 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Mostrando 10 de {parsedData.rows.length} linhas
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UploadPage;
