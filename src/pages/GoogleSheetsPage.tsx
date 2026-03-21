import { useEffect, useState, useCallback } from "react";
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
  Table,
  WifiOff,
  LogOut,
  History,
  BarChart3,
  Settings2,
  Timer,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useSyncJobs } from "@/hooks/useSyncJobs";
import { useSyncAudit } from "@/hooks/useSyncAudit";
import { SpreadsheetSelectorModal } from "@/components/modals/SpreadsheetSelectorModal";
import { SyncHistoryTable } from "@/components/sheets/SyncHistoryTable";
import { SyncErrorList } from "@/components/sheets/SyncErrorList";
import { SyncAuditTable } from "@/components/sheets/SyncAuditTable";
import { ProfileStatusCard } from "@/components/sheets/ProfileStatusCard";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { GoogleSheetsErrorBoundary } from "@/components/error/GoogleSheetsErrorBoundary";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Info } from "lucide-react";

const SHEET_ADMIN_EMAILS = ["leomateus620@gmail.com", "contato@cwfinancas.com"];

const CONNECTION_VALIDITY_DAYS = 30;

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

const getConnectionExpiry = (createdAt: string) => {
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + CONNECTION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  return expiry;
};

const isConnectionExpired = (createdAt: string) => {
  return new Date() > getConnectionExpiry(createdAt);
};

const formatExpiryDate = (createdAt: string) => {
  const expiry = getConnectionExpiry(createdAt);
  return expiry.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

type PageState = "loading" | "not_connected" | "error" | "success";

// Sync History Section Component
function SyncHistorySection() {
  const { runs, stats, isLoading } = useSyncStatus();
  const { data: audits } = useSyncAudit();
  
  if (isLoading || runs.length === 0) return null;

  const lastRun = runs[0];
  const hasErrors = lastRun?.rows_failed > 0;

  // Get audits from the most recent sync job
  const latestAudits = audits?.slice(0, 20) || [];

  return (
    <Card className="glass-premium border-border/50 shadow-premium-sm overflow-hidden relative">
      <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Sincronização
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              {stats.total_rows_upserted} linhas importadas
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        <SyncHistoryTable runs={runs.slice(0, 5)} />
        
        {hasErrors && lastRun.errors?.length > 0 && (
          <SyncErrorList 
            errors={lastRun.errors} 
            maxErrors={5}
          />
        )}

        {latestAudits.length > 0 && (
          <SyncAuditTable audits={latestAudits} />
        )}
      </CardContent>
    </Card>
  );
}

function GoogleSheetsPageContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSelector, setShowSelector] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isSheetAdmin = SHEET_ADMIN_EMAILS.includes(user?.email ?? "");
  
  const {
    oauthStatus,
    isGoogleAuthorized,
    isCheckingAuth,
    authCheckError,
    refetchAuthStatus,
    connections,
    isLoadingConnections,
    connectionsError,
    getAuthUrl,
    exchangeCode,
    listSpreadsheets,
    getSpreadsheetSheets,
    createConnection,
    syncData,
    syncAllTabs,
    deleteConnection,
    disconnectGoogle,
    resetSheetData,
  } = useGoogleSheets();

  const hasExistingConnection = (connections ?? []).length > 0;
  const hasExpiredConnection = hasExistingConnection && !isSheetAdmin && (connections ?? []).every(c => isConnectionExpired(c.created_at));
  const canConnect = isSheetAdmin || (!hasExistingConnection || hasExpiredConnection);

  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Determine page state
  const getPageState = (): PageState => {
    if (isCheckingAuth || isLoadingConnections || exchangeCode.isPending) {
      return "loading";
    }
    if (authCheckError || connectionsError || pageError) {
      return "error";
    }
    if (!isGoogleAuthorized && !searchParams.get("code")) {
      return "not_connected";
    }
    return "success";
  };

  const pageState = getPageState();
  const errorMessage = authCheckError?.message || connectionsError?.message || pageError;

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !exchangeCode.isPending && !exchangeCode.isSuccess) {
      setSearchParams({});
      exchangeCode.mutate(code, {
        onSuccess: () => {
          setShowSelector(true);
        },
      });
    }
  }, [searchParams, exchangeCode.isPending, exchangeCode.isSuccess, setSearchParams]);

  // Open selector after successful OAuth
  useEffect(() => {
    if (exchangeCode.isSuccess && isGoogleAuthorized) {
      setShowSelector(true);
    }
  }, [exchangeCode.isSuccess, isGoogleAuthorized]);

  const handleConnect = async () => {
    setPageError(null);
    
    // If already authorized, just open the modal
    if (isGoogleAuthorized) {
      setShowSelector(true);
      return;
    }

    // Otherwise, start OAuth flow
    setIsConnecting(true);
    try {
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      const message = error instanceof Error ? error.message : "Não foi possível iniciar a conexão com o Google";
      setPageError(message);
      toast({
        title: "Erro ao conectar",
        description: message,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleRetry = () => {
    setPageError(null);
    refetchAuthStatus();
  };

  const isAPRConnection = (sheetName: string | null): boolean => {
    if (!sheetName) return false;
    const normalized = sheetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return normalized.includes("contas a pagar") || normalized.includes("contas a receber")
      || normalized.includes("a pagar") || normalized.includes("a receber");
  };

  const handleSync = (connection: { id: string; sheet_name: string | null; data_type: string; column_mapping: Record<string, string>; spreadsheet_name?: string }) => {
    // Always use syncAllTabs for: all_tabs connections, APR connections, or .xlsx files
    const isAllTabs = connection.sheet_name === null && connection.data_type === "all_tabs";
    const isAPR = isAPRConnection(connection.sheet_name);
    const isXlsx = (connection.spreadsheet_name || "").toLowerCase().endsWith(".xlsx");
    
    if (isAllTabs || isAPR || isXlsx) {
      const mapping = connection.column_mapping as Record<string, unknown>;
      const selectedTabs = mapping?.selected_tabs as string[] | undefined;
      const monthRange = mapping?.month_range as { from: string; to: string } | undefined;
      console.log(`[handleSync] Routing to syncAllTabs: isAllTabs=${isAllTabs}, isAPR=${isAPR}, isXlsx=${isXlsx}`);
      syncAllTabs.mutate({ connectionId: connection.id, selectedTabs, monthRange });
    } else {
      syncData.mutate(connection.id);
    }
  };

  // Job tracking for all connections
  const { activeJob, lastJob, hasActiveJob, isJobStale } = useSyncJobs();

  const handleDelete = (connectionId: string) => {
    if (confirm("Tem certeza que deseja desconectar esta planilha?")) {
      deleteConnection.mutate(connectionId);
    }
  };

  const handleDisconnectGoogle = () => {
    if (confirm("Tem certeza que deseja desconectar sua conta Google? Todas as conexões de planilhas serão removidas.")) {
      disconnectGoogle.mutate();
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

  // Callbacks for the modal
  const handleLoadSpreadsheets = useCallback((params?: { searchTerm?: string; pageToken?: string }) => {
    listSpreadsheets.mutate(params ?? {});
  }, [listSpreadsheets]);

  const handleGetSheets = useCallback((spreadsheetId: string) => {
    getSpreadsheetSheets.mutate(spreadsheetId);
  }, [getSpreadsheetSheets]);

  const handleCreateConnection = useCallback(async (params: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetName: string | null;
    selectedTabs?: string[];
  }) => {
    await createConnection.mutateAsync(params);
  }, [createConnection]);

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="space-y-6">
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
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              {exchangeCode.isPending ? "Conectando ao Google..." : "Carregando..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
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
          <CardContent className="py-12 text-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Erro ao carregar
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              {errorMessage || "Ocorreu um erro ao verificar a conexão com o Google."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleConnect} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Reconectar Google
              </Button>
              <Button onClick={handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not connected state
  if (pageState === "not_connected") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse-glow" />
              Google Sheets
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSheetAdmin
                ? "Conecte suas planilhas para importar dados automaticamente."
                : "Visualize e sincronize sua planilha conectada."}
            </p>
          </div>
        </div>

        {canConnect ? (
          <Card className="glass-premium border-border/50 shadow-premium-sm overflow-hidden relative">
            <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
            <CardContent className="py-16 text-center relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-float">
                <FileSpreadsheet className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Conecte sua Conta Google
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                {isSheetAdmin
                  ? "Para importar dados das suas planilhas, primeiro conecte sua conta Google. Isso permitirá listar e selecionar as planilhas que você deseja sincronizar."
                  : "Conecte sua conta Google para selecionar a planilha com seus dados financeiros. Você poderá realizar uma única conexão."}
              </p>
              <Button 
                onClick={handleConnect}
                disabled={isConnecting}
                size="lg"
                className="gap-2 rounded-xl"
              >
                {isConnecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ExternalLink className="w-5 h-5" />
                )}
                <span>Conectar ao Google</span>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-premium border-border/50 shadow-premium-sm overflow-hidden relative">
            <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
            <CardContent className="py-16 text-center relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
                <Info className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Planilha ainda não configurada
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Sua planilha será configurada pela equipe CW Finanças. 
                Entre em contato com o administrador para conectar sua planilha.
              </p>
            </CardContent>
          </Card>
        )}

        {/* How it works - only for admins */}
        {isSheetAdmin && (
          <Card className="glass-premium border-border/50 shadow-premium-sm bg-gradient-to-br from-chart-2/5 to-transparent overflow-hidden relative">
            <div className="absolute inset-0 gradient-mesh opacity-20 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3 text-sm text-muted-foreground">
              <p><strong>1.</strong> Clique em "Conectar ao Google" e autorize o acesso.</p>
              <p><strong>2.</strong> Selecione a planilha e a aba com seus dados financeiros.</p>
              <p><strong>3.</strong> O sistema detectará automaticamente as colunas.</p>
              <p><strong>4.</strong> Confirme e importe os dados para o sistema.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Success state (connected)
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
        <div className="flex items-center gap-2">
          {isSheetAdmin && (
            <>
              <Button 
                variant="outline"
                onClick={handleDisconnectGoogle}
                disabled={disconnectGoogle.isPending}
                className="gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {disconnectGoogle.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Desconectar Google</span>
              </Button>
              <Button 
                onClick={handleConnect}
                disabled={isConnecting || exchangeCode.isPending || isCheckingAuth}
                className="gap-2 rounded-xl bg-primary hover:bg-primary/90 group transition-premium"
              >
                {isConnecting || exchangeCode.isPending || isCheckingAuth ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                <span>Conectar Planilha</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reauth banner when scope is insufficient */}
      {oauthStatus?.needs_reauth && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Permissões desatualizadas</p>
              <p className="text-xs text-muted-foreground">
                Reconecte sua conta Google para acessar planilhas compartilhadas com você.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-warning/50 text-warning hover:bg-warning/10"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reconectar Google
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connections List */}
      {(connections ?? []).length > 0 ? (
        <div className="grid gap-4">
          {(connections ?? []).map((connection, index) => {
            const statusInfo = getStatusInfo(connection.sync_status);
            const StatusIcon = statusInfo.icon;
            const isSyncing = (syncData.isPending && syncData.variables === connection.id) || (syncAllTabs.isPending && syncAllTabs.variables?.connectionId === connection.id);
            const jobForConnection = activeJob?.connection_id === connection.id ? activeJob : null;
            const isJobRunning = !!jobForConnection;
            const expired = !isSheetAdmin && isConnectionExpired(connection.created_at);
            const syncDisabled = isSyncing || isJobRunning || expired;

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
                        {connection.sheet_name ? (
                          <p className="text-sm text-muted-foreground">
                            Aba: {connection.sheet_name}
                          </p>
                        ) : connection.data_type === "all_tabs" ? (
                          <p className="text-sm text-muted-foreground">
                            Todas as abas (transações mensais)
                          </p>
                        ) : null}
                        <div className="flex items-center flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <StatusIndicator status={statusInfo.indicator} size="sm" pulse={connection.sync_status === "syncing" || isJobRunning} />
                            <span className={statusInfo.color}>
                              {isJobRunning ? "Sincronizando..." : statusInfo.label}
                            </span>
                          </span>
                          <span>
                            Última sync: {formatDate(connection.last_sync_at)}
                          </span>
                          {!isSheetAdmin && (
                            <span className={cn("flex items-center gap-1", expired ? "text-destructive" : "text-success")}>
                              <Clock className="w-3 h-3" />
                              {expired
                                ? `Expirado em ${formatExpiryDate(connection.created_at)}`
                                : `Válido até ${formatExpiryDate(connection.created_at)}`}
                            </span>
                          )}
                        </div>
                        {/* Expired banner for non-admins */}
                        {expired && (
                          <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-xs text-destructive font-medium">
                              Sua conexão expirou. Entre em contato com o administrador para renovar o acesso.
                            </p>
                          </div>
                        )}
                        {/* Job progress indicator */}
                        {isJobRunning && jobForConnection?.progress && (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-primary">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>
                                {jobForConnection.progress.current_tab || "Processando..."}
                                {jobForConnection.progress.tabs_total ? ` (${jobForConnection.progress.tabs_done || 0}/${jobForConnection.progress.tabs_total} abas)` : ""}
                              </span>
                            </div>
                            {(jobForConnection.progress.tabs_total || 0) > 0 && (
                              <Progress 
                                value={((jobForConnection.progress.tabs_done || 0) / (jobForConnection.progress.tabs_total || 1)) * 100} 
                                className="h-1.5"
                              />
                            )}
                            {(jobForConnection.progress.rows_imported || 0) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {jobForConnection.progress.rows_imported} linhas importadas
                              </p>
                            )}
                          </div>
                        )}
                        {/* Stale job warning */}
                        {isJobStale && activeJob?.connection_id === connection.id && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                            <Timer className="w-3.5 h-3.5" />
                            <span>Sync parece travada. Tente novamente.</span>
                          </div>
                        )}
                        {/* Last job error */}
                        {!isJobRunning && lastJob?.connection_id === connection.id && (lastJob.status === "failed" || lastJob.status === "timeout") && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>
                              {lastJob.status === "timeout" ? "Timeout na última sync" : lastJob.error_message || "Erro na última sync"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(connection)}
                        disabled={syncDisabled}
                        className="gap-2 rounded-lg"
                      >
                        {syncDisabled ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Sincronizar</span>
                      </Button>
                      {isSheetAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(connection.id)}
                          className="gap-2 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : isSheetAdmin ? (
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
              disabled={isConnecting || isCheckingAuth}
              className="gap-2 rounded-xl"
            >
              {isConnecting || isCheckingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Conectar Primeira Planilha</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-premium border-border/50 shadow-premium-sm overflow-hidden relative">
          <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
          <CardContent className="py-16 text-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
              <Info className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Planilha ainda não configurada
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Sua planilha será configurada pela equipe CW Finanças. 
              Entre em contato com o administrador para conectar sua planilha.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Profile Status Cards for each connection */}
      {(connections ?? []).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(connections ?? []).map((connection) => (
            <ProfileStatusCard 
              key={`profile-${connection.id}`}
              connectionId={connection.id}
              tabName={connection.sheet_name || undefined}
            />
          ))}
        </div>
      )}

      {/* Sync History Section - only show when there are connections */}
      <SyncHistorySection />

      {/* Danger Zone: Reset Data - admin only */}
      {isSheetAdmin && (connections ?? []).length > 0 && (
        <Card className="border-destructive/30 shadow-premium-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis sobre os dados importados.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <AlertDialog open={showResetDialog} onOpenChange={(open) => { setShowResetDialog(open); if (!open) setResetConfirmText(""); }}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={resetSheetData.isPending}
                >
                  {resetSheetData.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Zerar Dados Importados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zerar todos os dados importados?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      Esta ação vai <strong>apagar permanentemente</strong> todos os dados importados das planilhas:
                      transações, DRE, agregações, insights e histórico de sync.
                    </p>
                    <p>
                      Seus dados de conta, configurações e permissões serão mantidos.
                    </p>
                    <p className="font-medium text-destructive">
                      Digite <strong>ZERAR</strong> para confirmar:
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Digite ZERAR"
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={resetConfirmText !== "ZERAR" || resetSheetData.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      resetSheetData.mutate({}, {
                        onSuccess: () => {
                          setShowResetDialog(false);
                          setResetConfirmText("");
                        },
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetSheetData.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Confirmar Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Info Card - admin only */}
      {isSheetAdmin && (
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
      )}

      {/* Spreadsheet Selector Modal */}
      <SpreadsheetSelectorModal 
        open={showSelector}
        onOpenChange={setShowSelector}
        spreadsheets={listSpreadsheets.data?.spreadsheets}
        nextPageToken={listSpreadsheets.data?.nextPageToken}
        isLoadingSpreadsheets={listSpreadsheets.isPending}
        onLoadSpreadsheets={handleLoadSpreadsheets}
        onGetSheets={handleGetSheets}
        sheetsData={getSpreadsheetSheets.data}
        isLoadingSheets={getSpreadsheetSheets.isPending}
        onCreateConnection={handleCreateConnection}
        isCreatingConnection={createConnection.isPending}
      />
    </div>
  );
}

export function GoogleSheetsPage() {
  return (
    <GoogleSheetsErrorBoundary>
      <GoogleSheetsPageContent />
    </GoogleSheetsErrorBoundary>
  );
}

export default GoogleSheetsPage;
