import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllDemandDocuments } from "@/hooks/useAllDemandDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { getDemandDocumentSignedUrl } from "@/hooks/useDemandDocuments";
import { GlassCard } from "@/components/home/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileText, AlertCircle, ShieldAlert, FolderOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function fmtSize(v: number | null) {
  if (!v) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}

export default function DemandsDocumentsPage() {
  const { isManager, isLoading: roleLoading } = useUserRole();
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useAllDemandDocuments(search);

  if (!roleLoading && !isManager) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Acesso restrito</p>
      </div>
    );
  }

  const download = async (path: string) => {
    try {
      const url = await getDemandDocumentSignedUrl(path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground mt-1">Todos os arquivos enviados nas demandas financeiras.</p>
      </div>

      <GlassCard className="p-4">
        <Input placeholder="Buscar por nome do arquivo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <div className="p-12 text-center"><AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" /><p className="text-sm">Falha ao carregar.</p></div>
        ) : !data || data.length === 0 ? (
          <div className="p-16 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" />
            <p className="text-sm">Nenhum documento ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/40 border-b border-black/[0.04]">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Demanda</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Tamanho</th>
                <th className="px-4 py-3">Enviado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-black/[0.03] hover:bg-white/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-medium truncate max-w-[280px]">{d.file_name}</span></div>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/demands/${d.demand_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      {d.demand?.title ?? "—"} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.file_type ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">{fmtSize(d.file_size)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => download(d.file_path)}>
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}
