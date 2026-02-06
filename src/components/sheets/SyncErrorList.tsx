import { AlertTriangle, ExternalLink, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncError {
  row?: number;
  error?: string;
  message?: string;
}

interface SyncErrorListProps {
  errors: SyncError[];
  spreadsheetId?: string;
  sheetName?: string;
  maxErrors?: number;
}

export function SyncErrorList({ 
  errors, 
  spreadsheetId, 
  sheetName,
  maxErrors = 10 
}: SyncErrorListProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  const displayErrors = errors.slice(0, maxErrors);
  const hasMore = errors.length > maxErrors;

  const getGoogleSheetsUrl = (row?: number) => {
    if (!spreadsheetId) return null;
    let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    if (sheetName) {
      url += `#gid=0`;
    }
    if (row) {
      url += `&range=A${row}`;
    }
    return url;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">
          {errors.length} erro{errors.length > 1 ? "s" : ""} de importação
        </span>
      </div>

      <div className="space-y-2">
        {displayErrors.map((error, index) => {
          const url = getGoogleSheetsUrl(error.row);
          const errorMessage = error.error || error.message || "Erro desconhecido";

          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                "bg-destructive/5 border border-destructive/20"
              )}
            >
              <FileWarning className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {error.row && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Linha {error.row}
                    </span>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver na planilha
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1">{errorMessage}</p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <p className="text-xs text-muted-foreground text-center">
          + {errors.length - maxErrors} outros erros não exibidos
        </p>
      )}
    </div>
  );
}
