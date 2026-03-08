import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const ALL_QUERY_KEYS_TO_INVALIDATE = [
  "transactions", "home-dashboard", "sync-jobs", "google-sheet-connections",
  "google-oauth-status", "dre-periods", "dre-lines", "balance-sheet",
  "invoices", "ai-insights", "finance-insights", "flagged-transactions", "cash-flow",
  "apr-payable", "apr-receivable",
];

interface GoogleSheetConnection {
  id: string;
  user_id: string;
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet_name: string | null;
  column_mapping: Record<string, string>;
  data_type: string;
  last_sync_at: string | null;
  sync_status: string;
  sync_frequency: string;
  created_at: string;
  updated_at: string;
}

interface Spreadsheet {
  id: string;
  name: string;
  modified_time: string;
  owner?: string;
  shared?: boolean;
}

interface Sheet {
  sheet_id: number;
  title: string;
  index: number;
}

interface SheetPreview {
  spreadsheet: { id: string; name: string };
  sheets: Sheet[];
  preview: { range: string; values: string[][]; row_count: number };
}

interface SyncResult {
  success: boolean;
  rows_processed: number;
  rows_imported: number;
  rows_skipped: number;
  errors: Array<{ row: number; error: string }>;
}

interface SyncAllTabsResult {
  success: boolean;
  tabs_imported: number;
  tab_results: Array<{ tab: string; periodKey: string; rowsImported: number; rowsSkipped: number; errors: number }>;
  total_imported: number;
  total_skipped: number;
  total_errors: number;
  errors: Array<{ tab: string; row: number; error: string }>;
}

interface MonthRange {
  from: string;
  to: string;
}

interface OAuthStatus {
  connected: boolean;
  code: string;
  message: string;
  token_expired?: boolean;
  needs_reauth?: boolean;
}

export function useGoogleSheets() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check OAuth status via backend (no tokens exposed to frontend)
  const { 
    data: oauthStatus, 
    isLoading: isCheckingAuth,
    error: authCheckError,
    refetch: refetchAuthStatus,
  } = useQuery<OAuthStatus>({
    queryKey: ["google-oauth-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-oauth-status");
      
      if (error) {
        console.error("Error checking Google OAuth status:", error);
        throw error;
      }
      
      return data as OAuthStatus;
    },
    enabled: !!session,
    staleTime: 30000, // 30 seconds
    retry: 1,
  });

  const isGoogleAuthorized = oauthStatus?.connected ?? false;

  // Fetch user's connections
  const { 
    data: connections, 
    isLoading: isLoadingConnections,
    error: connectionsError,
  } = useQuery({
    queryKey: ["google-sheet-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_sheet_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GoogleSheetConnection[];
    },
    enabled: !!session,
  });

  // Get OAuth URL
  const getAuthUrl = useCallback(async () => {
    const redirectUri = `${window.location.origin}/google-sheets`;
    
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    const response = await fetch(functionUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${session?.access_token}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.auth_url;
  }, [session?.access_token]);

  // Exchange code for tokens (backend persists, no tokens returned)
  const exchangeCode = useMutation({
    mutationFn: async (code: string) => {
      const redirectUri = `${window.location.origin}/google-sheets`;
      
      const { data, error } = await supabase.functions.invoke("google-sheets-auth", {
        body: { code, redirect_uri: redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      // Invalidate auth status to reflect new connection
      queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
      toast({
        title: "Conectado ao Google",
        description: "Agora você pode selecionar uma planilha para importar.",
      });
    },
    onError: (error) => {
      console.error("OAuth exchange error:", error);
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // List spreadsheets from new robust function
  const listSpreadsheets = useMutation({
    mutationFn: async ({ pageToken, searchTerm }: { pageToken?: string; searchTerm?: string } = {}) => {
      const body: Record<string, string> = {};
      if (pageToken) body.pageToken = pageToken;
      if (searchTerm) body.searchTerm = searchTerm;

      const { data, error } = await supabase.functions.invoke("google-list-sheets", {
        body,
      });

      if (error) throw error;
      
      if (data.code === "NOT_CONNECTED" || data.code === "REAUTH_REQUIRED") {
        throw new Error(data.message || "Reconecte sua conta Google");
      }
      
      if (data.code && data.code !== "CONNECTED") {
        throw new Error(data.message || "Erro ao listar planilhas");
      }
      
      return {
        spreadsheets: data.spreadsheets as Spreadsheet[],
        nextPageToken: data.nextPageToken as string | undefined,
      };
    },
    onError: (error) => {
      console.error("Error listing spreadsheets:", error);
      toast({
        title: "Erro ao listar planilhas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Get sheet preview from new function
  const getSheetPreview = useMutation({
    mutationFn: async ({ spreadsheetId, sheetName }: { spreadsheetId: string; sheetName?: string }) => {
      const { data, error } = await supabase.functions.invoke("google-read-sheet-preview", {
        body: { spreadsheetId, sheetName },
      });

      if (error) throw error;
      
      if (data.code && data.code !== "CONNECTED") {
        throw new Error(data.message || "Erro ao ler planilha");
      }
      
      return data as SheetPreview;
    },
    onError: (error) => {
      console.error("Error getting sheet preview:", error);
      toast({
        title: "Erro ao ler planilha",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Legacy: Get sheets from a spreadsheet (for compatibility)
  const getSpreadsheetSheets = useMutation({
    mutationFn: async (spreadsheetId: string) => {
      const preview = await getSheetPreview.mutateAsync({ spreadsheetId });
      return {
        spreadsheet_name: preview.spreadsheet.name,
        sheets: preview.sheets,
      };
    },
  });

  // Create connection
  const createConnection = useMutation({
    mutationFn: async ({
      spreadsheetId,
      spreadsheetName,
      sheetName,
      dataType,
      selectedTabs,
    }: {
      spreadsheetId: string;
      spreadsheetName: string;
      sheetName: string | null;
      dataType?: string;
      selectedTabs?: string[];
    }) => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }

      // Get tokens from persisted auth (backend will use them)
      const { data: tokenData, error: tokenError } = await supabase
        .from("google_oauth_tokens")
        .select("access_token, refresh_token, expires_at")
        .single();

      if (tokenError || !tokenData) {
        throw new Error("Google authorization not found. Please reconnect.");
      }

      // Determine data_type and store month_range in column_mapping
      const isAllTabs = sheetName === null;
      const finalDataType = dataType || (isAllTabs ? "all_tabs" : "transactions");
      const columnMapping = isAllTabs && selectedTabs 
        ? JSON.parse(JSON.stringify({ selected_tabs: selectedTabs }))
        : {};

      const { data, error } = await supabase
        .from("google_sheet_connections")
        .insert({
          user_id: session.user.id,
          spreadsheet_id: spreadsheetId,
          spreadsheet_name: spreadsheetName,
          sheet_name: sheetName,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: tokenData.expires_at,
          data_type: finalDataType,
          column_mapping: columnMapping,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      toast({
        title: "Planilha conectada",
        description: "Sua planilha foi conectada com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error creating connection:", error);
      toast({
        title: "Erro ao conectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Sync data (single tab)
  const syncData = useMutation({
    mutationFn: async ({ connectionId, forceRefresh }: { connectionId: string; forceRefresh?: boolean } | string) => {
      const id = typeof arguments[0] === "string" ? arguments[0] as string : (arguments[0] as any).connectionId;
      const force = typeof arguments[0] === "string" ? true : ((arguments[0] as any).forceRefresh ?? true);
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: { connection_id: id, force_refresh: force },
      });

      if (error) {
        console.warn("Sync request error:", error.message);
        throw error;
      }
      if (data.error) throw new Error(data.error);
      
      return data as SyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["sync-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["bank-balances"] });
      queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.rows_imported} linhas importadas de ${data.rows_processed} processadas.`,
      });
    },
    onError: (error) => {
      console.error("Sync error:", error);
      queryClient.invalidateQueries({ queryKey: ["sync-jobs"] });
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("FunctionsFetchError") || msg.includes("Failed to send")) {
        toast({
          title: "Sincronização iniciada",
          description: "A sincronização está em andamento. Acompanhe o progresso abaixo.",
        });
      } else {
        toast({
          title: "Erro na sincronização",
          description: msg || "Erro desconhecido",
          variant: "destructive",
        });
      }
    },
  });

  // Sync all tabs (monthly transactions only) - fire-and-forget with job tracking
  const syncAllTabs = useMutation({
    mutationFn: async ({ connectionId, selectedTabs, monthRange, forceRefresh }: { connectionId: string; selectedTabs?: string[]; monthRange?: MonthRange; forceRefresh?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("sheets-sync-all-tabs", {
        body: { connection_id: connectionId, selected_tabs: selectedTabs, month_range: monthRange, force_refresh: forceRefresh ?? true },
      });

      // If we get a 409 (already_running), show specific message
      if (error) {
        const errorMsg = error.message || "";
        if (errorMsg.includes("already_running") || errorMsg.includes("409")) {
          throw new Error("already_running");
        }
        // Network errors (FunctionsFetchError) - the job may still be running on the server
        console.warn("Sync request error (job may still be running):", errorMsg);
        throw error;
      }
      if (data?.error === "already_running") {
        throw new Error("already_running");
      }
      if (data?.error) throw new Error(data.error);

      return data as SyncAllTabsResult;
    },
    onSuccess: (data) => {
      ALL_QUERY_KEYS_TO_INVALIDATE.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      const parts: string[] = [];
      if (data.tabs_imported > 0) parts.push(`${data.tabs_imported} aba(s) mensal(is)`);
      if (data.total_imported > 0) parts.push(`${data.total_imported} linhas importadas`);
      if (parts.length === 0) parts.push("Sincronização concluída sem novos dados");
      toast({
        title: "Sincronização concluída",
        description: parts.join(", ") + ".",
      });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      queryClient.invalidateQueries({ queryKey: ["sync-jobs"] });
      if (msg === "already_running") {
        toast({
          title: "Sincronização já em andamento",
          description: "Aguarde a sincronização atual terminar antes de iniciar outra.",
        });
      } else if (msg.includes("FunctionsFetchError") || msg.includes("Failed to send")) {
        // Network error - job may still be processing server-side
        toast({
          title: "Sincronização iniciada",
          description: "A sincronização está em andamento. Acompanhe o progresso abaixo.",
        });
      } else {
        toast({
          title: "Erro na sincronização",
          description: msg || "Erro desconhecido",
          variant: "destructive",
        });
      }
    },
  });

  // Update column mapping
  const updateMapping = useMutation({
    mutationFn: async ({
      connectionId,
      mapping,
    }: {
      connectionId: string;
      mapping: Record<string, string>;
    }) => {
      const { error } = await supabase
        .from("google_sheet_connections")
        .update({ column_mapping: mapping })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
    },
  });

  // Delete connection (with reset first)
  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      // Step 1: Reset all imported data for this connection
      const { data: resetResult, error: resetError } = await supabase.functions.invoke("reset-sheet-data", {
        body: { connection_id: connectionId, scope: "ALL" },
      });
      if (resetError) {
        console.error("Reset error before delete:", resetError);
        throw new Error("Falha ao limpar dados importados. Desconexão cancelada.");
      }
      if (resetResult?.error) throw new Error(resetResult.error);
      console.log("[deleteConnection] Reset result:", resetResult);

      // Step 2: Only after successful reset, delete the connection
      const { error } = await supabase
        .from("google_sheet_connections")
        .delete()
        .eq("id", connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      ALL_QUERY_KEYS_TO_INVALIDATE.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      toast({
        title: "Conexão removida",
        description: "A planilha e todos os dados importados foram removidos.",
      });
    },
    onError: (error) => {
      console.error("Delete connection error:", error);
      toast({
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Reset all imported data (manual button)
  const resetSheetData = useMutation({
    mutationFn: async ({ connectionId, scope }: { connectionId?: string; scope?: string } = {}) => {
      const { data, error } = await supabase.functions.invoke("reset-sheet-data", {
        body: { connection_id: connectionId || null, scope: scope || "ALL" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      ALL_QUERY_KEYS_TO_INVALIDATE.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      toast({
        title: "Dados zerados",
        description: "Todos os dados importados foram removidos. Pronto para reimportar.",
      });
    },
    onError: (error) => {
      console.error("Reset sheet data error:", error);
      toast({
        title: "Erro ao zerar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Disconnect Google account entirely (with reset first)
  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");

      // Step 1: Reset ALL data for every connection
      const { data: conns } = await supabase
        .from("google_sheet_connections")
        .select("id")
        .eq("user_id", session.user.id);

      if (conns && conns.length > 0) {
        for (const conn of conns) {
          const { error: resetErr } = await supabase.functions.invoke("reset-sheet-data", {
            body: { connection_id: conn.id, scope: "ALL" },
          });
          if (resetErr) {
            console.error(`Reset failed for connection ${conn.id}:`, resetErr);
            throw new Error("Falha ao limpar dados. Desconexão cancelada.");
          }
        }
      }

      // Step 2: Delete OAuth tokens
      const { error: tokenError } = await supabase
        .from("google_oauth_tokens")
        .delete()
        .eq("user_id", session.user.id);
      if (tokenError) throw tokenError;
      
      // Step 3: Delete all sheet connections
      const { error: connError } = await supabase
        .from("google_sheet_connections")
        .delete()
        .eq("user_id", session.user.id);
      if (connError) throw connError;
    },
    onSuccess: () => {
      ALL_QUERY_KEYS_TO_INVALIDATE.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
      toast({
        title: "Desconectado",
        description: "Conta Google desconectada e todos os dados importados foram limpos.",
      });
    },
    onError: (error) => {
      console.error("Disconnect Google error:", error);
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  return {
    // Auth status
    oauthStatus,
    isGoogleAuthorized,
    isCheckingAuth,
    authCheckError,
    refetchAuthStatus,
    
    // Connections
    connections,
    isLoadingConnections,
    connectionsError,
    
    // OAuth flow
    getAuthUrl,
    exchangeCode,
    
    // Spreadsheet operations
    listSpreadsheets,
    getSheetPreview,
    getSpreadsheetSheets, // Legacy compatibility
    
    // Connection operations
    createConnection,
    syncData,
    syncAllTabs,
    updateMapping,
    deleteConnection,
    disconnectGoogle,
    resetSheetData,
  };
}
