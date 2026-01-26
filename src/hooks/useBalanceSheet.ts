import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface BalanceSheetItem {
  id: string;
  user_id: string;
  type: "asset" | "liability" | "equity";
  category: string;
  name: string;
  amount: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export type BalanceSheetItemInput = Omit<BalanceSheetItem, "id" | "user_id" | "created_at" | "updated_at">;

export function useBalanceSheet(date?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["balance-sheet", user?.id, date],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("balance_sheet_items")
        .select("*")
        .order("type")
        .order("category")
        .order("name");

      if (date) {
        query = query.lte("date", date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BalanceSheetItem[];
    },
    enabled: !!user?.id,
  });

  const createItem = useMutation({
    mutationFn: async (input: BalanceSheetItemInput) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("balance_sheet_items")
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      toast({
        title: "Item adicionado",
        description: "O item foi adicionado ao balanço.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar item",
        description: error.message,
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<BalanceSheetItemInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("balance_sheet_items")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      toast({
        title: "Item atualizado",
        description: "O item foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar item",
        description: error.message,
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("balance_sheet_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      toast({
        title: "Item excluído",
        description: "O item foi removido do balanço.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir item",
        description: error.message,
      });
    },
  });

  // Group items by type
  const assets = items?.filter(i => i.type === "asset") ?? [];
  const liabilities = items?.filter(i => i.type === "liability") ?? [];
  const equity = items?.filter(i => i.type === "equity") ?? [];

  // Calculate totals
  const totals = {
    assets: assets.reduce((sum, i) => sum + Number(i.amount), 0),
    liabilities: liabilities.reduce((sum, i) => sum + Number(i.amount), 0),
    equity: equity.reduce((sum, i) => sum + Number(i.amount), 0),
  };

  // Group by category within each type
  const groupByCategory = (itemList: BalanceSheetItem[]) => {
    return itemList.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, BalanceSheetItem[]>);
  };

  return {
    items: items ?? [],
    assets,
    liabilities,
    equity,
    assetsByCategory: groupByCategory(assets),
    liabilitiesByCategory: groupByCategory(liabilities),
    equityByCategory: groupByCategory(equity),
    totals,
    isLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
  };
}
