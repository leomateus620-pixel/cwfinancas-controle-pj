import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Eye, FileUp } from "lucide-react";
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
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ParsedData {
  headers: string[];
  rows: any[][];
  fileName: string;
}

export function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "parsing" | "success" | "error">("idle");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

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
        setUploadStatus("success");
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

          {uploadStatus === "success" && parsedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-success/5 border border-success/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-success" />
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

      {/* Preview dos Dados */}
      {parsedData && uploadStatus === "success" && (
        <Card className="border-border/50 shadow-premium-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Preview dos Dados
                </CardTitle>
                <CardDescription>
                  Primeiras 10 linhas do arquivo importado
                </CardDescription>
              </div>
              <Button>Importar Dados</Button>
            </div>
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
