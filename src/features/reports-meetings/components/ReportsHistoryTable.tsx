import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runReportsMeetingsCloudDiagnostics, type CloudErrorCode, classifyFunctionError } from "../lib/cloudDiagnostics";

type Meeting = { id: string; title: string; status: string; cloud_status: string; started_at: string; summary_status: string };

export function ReportsHistoryTable() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase.functions.invoke("reports-meetings-list", { body: {} });
    if (error) {
      const code: CloudErrorCode = classifyFunctionError(error);
      setError(`Falha ao listar reuniões (${code}): ${error.message}`);
      return;
    }
    setMeetings(data?.meetings ?? []);
  };

  const runDiagnostics = async () => setDebug(await runReportsMeetingsCloudDiagnostics());

  useEffect(() => { void load(); }, []);

  return <div className="rounded-2xl border bg-white/70 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Histórico de reuniões na nuvem</h3><div className="flex gap-2"><button className="text-xs underline" onClick={() => void runDiagnostics()}>Testar nuvem</button><button className="text-xs underline" onClick={() => void load()}>Recarregar</button></div></div>
    {error && <div className="text-sm text-red-700">{error}</div>}
    {!error && meetings.length === 0 && <div className="text-sm text-muted-foreground">Sem reuniões salvas.</div>}
    {meetings.length > 0 && <div className="space-y-2">{meetings.map((m) => <div className="text-sm border rounded p-2" key={m.id}><b>{m.title}</b> • {m.status} • nuvem: {m.cloud_status ?? "-"} • resumo: {m.summary_status ?? "-"}</div>)}</div>}
    {debug && <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(debug, null, 2)}</pre>}
  </div>;
}
