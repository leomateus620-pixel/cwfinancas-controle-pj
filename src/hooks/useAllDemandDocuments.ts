import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocRow {
  id: string;
  demand_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by: string;
  demand: { title: string; created_by: string; status: string } | null;
}

export function useAllDemandDocuments(search = "") {
  return useQuery({
    queryKey: ["all-demand-documents", search],
    queryFn: async () => {
      let q = supabase
        .from("financial_demand_documents")
        .select("id, demand_id, file_name, file_path, file_type, file_size, created_at, uploaded_by, demand:financial_demands(title, created_by, status)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (search.trim()) q = q.ilike("file_name", `%${search.trim()}%`);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as DocRow[];
    },
    staleTime: 30_000,
  });
}
