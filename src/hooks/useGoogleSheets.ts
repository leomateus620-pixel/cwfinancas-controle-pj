import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

interface OAuthStatus {
  connected: boolean;
  code: string;
  message: string;
  token_expired?: boolean;
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
    mutationFn: async (pageToken?: string) => {
      const { data, error } = await supabase.functions.invoke("google-list-sheets", {
        body: pageToken ? { pageToken } : {},
      });

      if (error) throw error;
      
      if (data.code === "NOT_CONNECTED" || data.code === "REAUTH_REQUIRED") {
        throw new Error(data.message || "Reconecte sua conta Google");
      }
      
      if (data.code && data.code !== "CONNECTED") {
        throw new Error(data.message || "Erro ao listar planilhas");
      }
      
      return data.spreadsheets as Spreadsheet[];
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
      dataType = "transactions",
    }: {
      spreadsheetId: string;
      spreadsheetName: string;
      sheetName: string | null;
      dataType?: string;
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
          data_type: dataType,
        })
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

  // Sync data
  const syncData = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: { connection_id: connectionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as SyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.rows_imported} linhas importadas de ${data.rows_processed} processadas.`,
      });
    },
    onError: (error) => {
      console.error("Sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
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

  // Delete connection
  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("google_sheet_connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      toast({
        title: "Conexão removida",
        description: "A planilha foi desconectada com sucesso.",
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

  // Disconnect Google account entirely
  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      
      // Delete OAuth tokens
      const { error: tokenError } = await supabase
        .from("google_oauth_tokens")
        .delete()
        .eq("user_id", session.user.id);
      
      if (tokenError) throw tokenError;
      
      // Delete all sheet connections
      const { error: connError } = await supabase
        .from("google_sheet_connections")
        .delete()
        .eq("user_id", session.user.id);
      
      if (connError) throw connError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      toast({
        title: "Desconectado",
        description: "Sua conta Google foi desconectada com sucesso.",
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
    updateMapping,
    deleteConnection,
    disconnectGoogle,
  };
}
