import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plug, Loader2, CheckCircle2, XCircle, FlaskConical, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useAsanaSettings, useSaveAsanaSettings, type AsanaSettings } from "@/hooks/useAsanaSettings";
import { useAllAsanaSyncLogs } from "@/hooks/useAsanaSyncLogs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT: AsanaSettings = {
  is_enabled: false,
  workspace_gid: "",
  project_gid: "",
  default_section_gid: "",
  default_assignee_gid: "",
  status_mapping: {},
  priority_mapping: {},
};

export default function AsanaSettingsPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data, isLoading } = useAsanaSettings();
  const save = useSaveAsanaSettings();
  const logs = useAllAsanaSyncLogs();

  const [form, setForm] = useState<AsanaSettings>(DEFAULT);
  const [statusJson, setStatusJson] = useState("{}");
  const [priorityJson, setPriorityJson] = useState("{}");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
      setStatusJson(JSON.stringify(data.status_mapping ?? {}, null, 2));
      setPriorityJson(JSON.stringify(data.priority_mapping ?? {}, null, 2));
    }
  }, [data]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/demands", { replace: true });
  }, [isAdmin, roleLoading, navigate]);

  const onSave = () => {
    try {
      const payload: AsanaSettings = {
        ...form,
        status_mapping: JSON.parse(statusJson || "{}"),
        priority_mapping: JSON.parse(priorityJson || "{}"),
      };
      save.mutate(payload, {
        onSuccess: () => toast.success("Configurações salvas"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
      });
    } catch (e) {
      toast.error("JSON inválido em mapeamentos");
    }
  };

  const onTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("asana-test-connection", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.ok) setTestResult({ ok: true, msg: `Conectado como ${data.user?.name ?? data.user?.email ?? "—"}` });
      else setTestResult({ ok: false, msg: data?.error ?? "Falha desconhecida" });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Erro" });
    } finally { setTesting(false); }
  };

  const onCreateTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("asana-create-task", { body: { dry_run: true } });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        setTestResult({ ok: true, msg: "Tarefa de teste criada no Asana", url: data.task_url });
        toast.success("Tarefa criada no Asana");
      } else setTestResult({ ok: false, msg: data?.error ?? "Falha" });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Erro" });
    } finally { setTesting(false); }
  };

  if (roleLoading || isLoading) {
    return <div className="p-6 max-w-4xl mx-auto space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2 mb-2">
          <Link to="/demands"><ArrowLeft className="w-4 h-4" />Demandas</Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Plug className="w-6 h-6 text-primary" /> Integração Asana
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações administrativas da integração com Asana. Token PAT é gerenciado em variáveis seguras do servidor.
        </p>
      </div>

      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Status da integração</div>
            <p className="text-xs text-muted-foreground">Quando desativada, novas demandas não criam tarefas no Asana.</p>
          </div>
          <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label className="text-sm">Workspace GID</Label>
            <Input value={form.workspace_gid ?? ""} onChange={(e) => setForm((f) => ({ ...f, workspace_gid: e.target.value }))} placeholder="(deixe vazio para usar env)" />
          </div>
          <div><Label className="text-sm">Project GID</Label>
            <Input value={form.project_gid ?? ""} onChange={(e) => setForm((f) => ({ ...f, project_gid: e.target.value }))} placeholder="(deixe vazio para usar env)" />
          </div>
          <div><Label className="text-sm">Default Section GID</Label>
            <Input value={form.default_section_gid ?? ""} onChange={(e) => setForm((f) => ({ ...f, default_section_gid: e.target.value }))} />
          </div>
          <div><Label className="text-sm">Default Assignee GID</Label>
            <Input value={form.default_assignee_gid ?? ""} onChange={(e) => setForm((f) => ({ ...f, default_assignee_gid: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Mapeamento de status → seção (JSON)</Label>
            <Textarea rows={6} value={statusJson} onChange={(e) => setStatusJson(e.target.value)}
              className="font-mono text-xs" placeholder='{"em_execucao": "1234567890"}' />
          </div>
          <div>
            <Label className="text-sm">Mapeamento de prioridade → tag (JSON)</Label>
            <Textarea rows={6} value={priorityJson} onChange={(e) => setPriorityJson(e.target.value)}
              className="font-mono text-xs" placeholder='{"urgente": "1234567890"}' />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onSave} disabled={save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </Button>
          <Button onClick={onTest} disabled={testing} variant="outline" className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Testar conexão
          </Button>
          <Button onClick={onCreateTest} disabled={testing} variant="outline" className="gap-2">
            <FlaskConical className="w-4 h-4" /> Criar tarefa de teste
          </Button>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.msg}
              {testResult.url && <a href={testResult.url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">abrir <ExternalLink className="w-3 h-3" /></a>}
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Últimos 50 logs de sincronização</h3>
          <Badge variant="outline">{logs.data?.length ?? 0}</Badge>
        </div>
        {logs.isLoading ? <Skeleton className="h-32 w-full" /> : !logs.data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum log ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-3">Quando</th><th className="pr-3">Ação</th><th className="pr-3">Status</th><th className="pr-3">Demanda</th><th>Erro</th></tr>
              </thead>
              <tbody>
                {logs.data.map((l) => (
                  <tr key={l.id} className="border-b border-black/[0.04]">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="pr-3">{l.action}</td>
                    <td className="pr-3">
                      <Badge variant="outline" className={l.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="pr-3 font-mono text-[10px]">{l.demand_id?.slice(0, 8) ?? "—"}</td>
                    <td className="text-rose-600 max-w-md truncate">{l.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
