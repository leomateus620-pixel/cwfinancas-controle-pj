import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoryRule {
  id: string;
  keyword: string;
  category: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCategoryRules() {
  return useQuery({
    queryKey: ["category-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_category_rules")
        .select("*")
        .order("priority", { ascending: false })
        .order("keyword", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as CategoryRule[];
    },
    staleTime: 30_000,
  });
}

export function useUpsertCategoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<CategoryRule> & { keyword: string; category: string }) => {
      const payload = {
        keyword: rule.keyword.trim(),
        category: rule.category.trim(),
        priority: rule.priority ?? 50,
        is_active: rule.is_active ?? true,
      };
      if (rule.id) {
        const { error } = await supabase.from("financial_category_rules").update(payload).eq("id", rule.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("financial_category_rules").insert(payload);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["category-rules"] }),
  });
}

export function useDeleteCategoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_category_rules").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["category-rules"] }),
  });
}
