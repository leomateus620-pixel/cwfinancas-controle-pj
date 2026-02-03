import { useState, useCallback } from "react";
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

interface SyncResult {
  success: boolean;
  rows_processed: number;
  rows_imported: number;
  rows_skipped: number;
  errors: Array<{ row: number; error: string }>;
}

interface PreviewResult {
  headers: string[];
  mapping: Record<string, string>;
  sample_rows: Record<string, any>[];
  total_rows: number;
}

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export function useGoogleSheets() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tempTokens, setTempTokens] = useState<GoogleTokens | null>(null);

  // Check if user has persistent Google auth
  const { data: persistedAuth, isLoading: isCheckingAuth } = useQuery({
    queryKey: ["google-oauth-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_oauth_tokens")
        .select("id, expires_at")
        .maybeSingle();

      if (error) {
        console.error("Error checking Google auth:", error);
        return null;
      }
      return data;
    },
    enabled: !!session,
  });

  const isGoogleAuthorized = !!persistedAuth || !!tempTokens;

  // Fetch user's connections
  const { data: connections, isLoading: isLoadingConnections } = useQuery({
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
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.auth_url;
  }, []);

  // Exchange code for tokens
  const exchangeCode = useMutation({
    mutationFn: async (code: string) => {
      const redirectUri = `${window.location.origin}/google-sheets`;
      
      const { data, error } = await supabase.functions.invoke("google-sheets-auth", {
        body: { code, redirect_uri: redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setTempTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      });
      
      // Invalidate auth status to reflect new persisted tokens
      queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Conectado ao Google",
        description: "Agora você pode selecionar uma planilha para importar.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // List spreadsheets (uses persisted tokens from backend)
  const listSpreadsheets = useMutation({
    mutationFn: async () => {
      // Backend will use persisted tokens or tempTokens if provided
      const body = tempTokens 
        ? { access_token: tempTokens.access_token, refresh_token: tempTokens.refresh_token }
        : {};

      const { data, error } = await supabase.functions.invoke("google-sheets-list", {
        body,
      });

      if (error) throw error;
      if (data.error) {
        if (data.needs_auth) {
          throw new Error("Autorização do Google expirada. Por favor, reconecte.");
        }
        throw new Error(data.error);
      }
      
      return data.spreadsheets as Spreadsheet[];
    },
    onError: (error) => {
      toast({
        title: "Erro ao listar planilhas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get sheets from a spreadsheet
  const getSpreadsheetSheets = useMutation({
    mutationFn: async (spreadsheetId: string) => {
      const body = tempTokens 
        ? { 
            access_token: tempTokens.access_token, 
            refresh_token: tempTokens.refresh_token,
            spreadsheet_id: spreadsheetId,
          }
        : { spreadsheet_id: spreadsheetId };

      const { data, error } = await supabase.functions.invoke("google-sheets-list", {
        body,
      });

      if (error) throw error;
      if (data.error) {
        if (data.needs_auth) {
          throw new Error("Autorização do Google expirada. Por favor, reconecte.");
        }
        throw new Error(data.error);
      }
      
      return {
        spreadsheet_name: data.spreadsheet_name as string,
        sheets: data.sheets as Sheet[],
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

      // Get tokens from temp or we'll use what's in the persisted auth
      const tokens = tempTokens;
      
      if (!tokens) {
        // If no temp tokens, we need to fetch from persisted
        const { data: tokenData, error: tokenError } = await supabase
          .from("google_oauth_tokens")
          .select("access_token, refresh_token, expires_at")
          .single();

        if (tokenError || !tokenData) {
          throw new Error("Google authorization not found");
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
      }

      const { data, error } = await supabase
        .from("google_sheet_connections")
        .insert({
          user_id: session.user.id,
          spreadsheet_id: spreadsheetId,
          spreadsheet_name: spreadsheetName,
          sheet_name: sheetName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expires_at,
          data_type: dataType,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
      setTempTokens(null); // Clear temp tokens after successful connection
      toast({
        title: "Planilha conectada",
        description: "Sua planilha foi conectada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Preview data
  const previewData = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: {
          connection_id: connectionId,
          preview_only: true,
          auto_detect: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data as PreviewResult;
    },
  });

  // Sync data
  const syncData = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: {
          connection_id: connectionId,
        },
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
      toast({
        title: "Erro na sincronização",
        description: error.message,
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
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    connections,
    isLoadingConnections,
    tempTokens,
    isGoogleAuthorized,
    isCheckingAuth,
    getAuthUrl,
    exchangeCode,
    listSpreadsheets,
    getSpreadsheetSheets,
    createConnection,
    previewData,
    syncData,
    updateMapping,
    deleteConnection,
  };
}
