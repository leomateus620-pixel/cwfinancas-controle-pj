import React, { Component, ErrorInfo, ReactNode } from "react";
import { FileSpreadsheet, RefreshCw, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  children: ReactNode;
  onReconnect?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Safe error message extraction
function getErrorMessage(error: unknown): string {
  if (!error) return "Ocorreu um erro inesperado";
  
  // If it's a string directly
  if (typeof error === 'string') return error;
  
  // If it's an Error with a string message
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  
  // If it has .message as string (duck typing)
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  
  // Fallback - try to serialize
  try {
    const serialized = JSON.stringify(error);
    // Don't show huge objects
    if (serialized.length > 200) {
      return "Ocorreu um erro inesperado";
    }
    return serialized;
  } catch {
    return "Erro desconhecido";
  }
}

// Inner component to use hooks
function GoogleSheetsErrorUI({ 
  error, 
  onRetry, 
  onReconnect 
}: { 
  error: Error | null; 
  onRetry: () => void;
  onReconnect?: () => void;
}) {
  const queryClient = useQueryClient();

  const handleRetry = () => {
    // Invalidate Google Sheets related queries
    queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
    queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
    queryClient.invalidateQueries({ queryKey: ["google-spreadsheets"] });
    onRetry();
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            Google Sheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Conecte suas planilhas para importar dados automaticamente.
          </p>
        </div>
      </div>

      <Card className="glass-premium border-destructive/30 shadow-premium-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
        <CardHeader className="text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Falha na Integração</CardTitle>
          <CardDescription className="text-muted-foreground">
            Ocorreu um erro ao carregar a integração com o Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono text-muted-foreground overflow-auto max-h-24">
            <strong className="text-destructive">Erro:</strong> {errorMessage}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={onReconnect}
            >
              <LogOut className="w-4 h-4" />
              Reconectar Google
            </Button>
            <Button
              className="gap-2"
              onClick={handleRetry}
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export class GoogleSheetsErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GoogleSheetsErrorBoundary caught an error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <GoogleSheetsErrorUI
          error={this.state.error}
          onRetry={this.handleRetry}
          onReconnect={this.props.onReconnect}
        />
      );
    }

    return this.props.children;
  }
}

export default GoogleSheetsErrorBoundary;
