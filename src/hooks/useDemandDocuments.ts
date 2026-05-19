import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DemandDocument {
  id: string;
  demand_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  document_type: string | null;
  extraction_status: string | null;
  created_at: string;
}

export function useDemandDocuments(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-documents", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_demand_documents")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DemandDocument[];
    },
    staleTime: 10_000,
  });
}

export function useUploadDemandDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, file }: { demandId: string; file: File }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Você precisa estar autenticado.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${demandId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase
        .storage
        .from("demand-documents")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await supabase
        .from("financial_demand_documents")
        .insert({
          demand_id: demandId,
          uploaded_by: uid,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
        });
      if (insErr) {
        await supabase.storage.from("demand-documents").remove([path]);
        throw new Error(insErr.message);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demand-documents", vars.demandId] });
      qc.invalidateQueries({ queryKey: ["demand-timeline", vars.demandId] });
    },
  });
}

export function useDeleteDemandDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path, demandId: _ }: { id: string; path: string; demandId: string }) => {
      const { error: delDb } = await supabase.from("financial_demand_documents").delete().eq("id", id);
      if (delDb) throw new Error(delDb.message);
      await supabase.storage.from("demand-documents").remove([path]);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demand-documents", vars.demandId] });
    },
  });
}

export async function getDemandDocumentSignedUrl(path: string) {
  const { data, error } = await supabase
    .storage
    .from("demand-documents")
    .createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
