import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Loader2,
  Plus,
  ExternalLink,
  Table
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { SpreadsheetSelectorModal } from "@/components/modals/SpreadsheetSelectorModal";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function GoogleSheetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSelector, setShowSelector] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  
  const {
    connections,
    isLoadingConnections,
    tempTokens,
    getAuthUrl,
    exchangeCode,
    syncData,
    deleteConnection,
  } = useGoogleSheets();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !tempTokens) {
      setSearchParams({});
      exchangeCode.mutate(code);
    }
  }, [searchParams, tempTokens]);

  // Show selector when tokens are available
  useEffect(() => {
    if (tempTokens) {
      setShowSelector(true);
    }
  }, [tempTokens]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast({
        title: "Erro ao conectar",
        description: error instanceof Error ? error.message : "Não foi possível iniciar a conexão com o Google",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleSync = (connectionId: string) => {
    syncData.mutate(connectionId);
  };

  const handleDelete = (connectionId: string) => {
    if (confirm("Tem certeza que deseja desconectar esta planilha?")) {
      deleteConnection.mutate(connectionId);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "success":
        return { icon: CheckCircle, color: "text-success", label: "Sincronizado", indicator: "success" as const };
      case "error":
        return { icon: AlertCircle, color: "text-destructive", label: "Erro", indicator: "danger" as const };
      case "syncing":
        return { icon: Loader2, color: "text-primary", label: "Sincronizando...", indicator: "info" as const };
      case "partial":
        return { icon: AlertCircle, color: "text-warning", label: "Parcial", indicator: "warning" as const };
      default:
        return { icon: Clock, color: "text-muted-foreground", label: "Pendente", indicator: "neutral" as const };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse-glow" />
            Google Sheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Conecte suas planilhas para importar dados automaticamente.
          </p>
        </div>
        <Button 
          onClick={handleConnect}
          disabled={isConnecting || exchangeCode.isPending}
          className="gap-2 rounded-xl bg-primary hover:bg-primary/90 group transition-premium"
        >
          {isConnecting || exchangeCode.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          )}
          <span>Conectar Planilha</span>
        </Button>
      </div>

      {/* Connections List */}
      {isLoadingConnections ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="grid gap-4">
          {connections.map((connection, index) => {
            const statusInfo = getStatusInfo(connection.sync_status);
            const StatusIcon = statusInfo.icon;
            const isSyncing = syncData.isPending && syncData.variables === connection.id;

            return (
              <Card 
                key={connection.id}
                className={cn(
                  "glass-premium border-border/50 shadow-premium-sm hover:shadow-premium-md transition-premium",
                  "animate-fade-in overflow-hidden relative"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Table className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          {connection.spreadsheet_name}
                          <a 
                            href={`https://docs.google.com/spreadsheets/d/${connection.spreadsheet_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </h3>
                        {connection.sheet_name && (
                          <p className="text-sm text-muted-foreground">
                            Aba: {connection.sheet_name}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <StatusIndicator status={statusInfo.indicator} size="sm" pulse={connection.sync_status === "syncing"} />
                            <span className={statusInfo.color}>{statusInfo.label}</span>
                          </span>
                          <span>
                            Última sync: {formatDate(connection.last_sync_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(connection.id)}
                        disabled={isSyncing}
                        className="gap-2 rounded-lg"
                      >
                        {isSyncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Sincronizar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(connection.id)}
                        className="gap-2 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-premium border-border/50 shadow-premium-sm overflow-hidden relative">
          <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
          <CardContent className="py-16 text-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-float">
              <FileSpreadsheet className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Nenhuma Planilha Conectada
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Conecte suas planilhas do Google Sheets para importar transações, notas fiscais e outros dados financeiros automaticamente.
            </p>
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="gap-2 rounded-xl"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Conectar Primeira Planilha</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="glass-premium border-border/50 shadow-premium-sm bg-gradient-to-br from-chart-2/5 to-transparent overflow-hidden relative">
        <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
        <CardHeader className="relative z-10">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>1.</strong> Clique em "Conectar Planilha" e autorize o acesso ao Google Sheets.
          </p>
          <p>
            <strong>2.</strong> Selecione a planilha e a aba que contém seus dados financeiros.
          </p>
          <p>
            <strong>3.</strong> O sistema detectará automaticamente as colunas (Data, Valor, Descrição, etc).
          </p>
          <p>
            <strong>4.</strong> Confirme o mapeamento e importe os dados para o sistema.
          </p>
          <p>
            <strong>5.</strong> Sincronize manualmente ou configure sincronização automática.
          </p>
        </CardContent>
      </Card>

      {/* Spreadsheet Selector Modal */}
      <SpreadsheetSelectorModal 
        open={showSelector}
        onOpenChange={setShowSelector}
      />
    </div>
  );
}

export default GoogleSheetsPage;
