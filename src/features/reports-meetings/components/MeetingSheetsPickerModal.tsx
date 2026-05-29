import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, Check, ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useMeetingSources } from "../hooks/useMeetingSources";

interface Spreadsheet {
  id: string;
  name: string;
  mimeType?: string;
  provider?: "google_sheets" | "drive_xlsx";
  modified_time?: string;
  modifiedTime?: string;
  owner?: string;
}

interface SheetTab {
  sheet_id: number;
  title: string;
  index: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingSheetsPickerModal({ open, onOpenChange }: Props) {
  const { connectSheet } = useMeetingSources();
  const [step, setStep] = useState<"list" | "tabs">("list");
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Spreadsheet | null>(null);
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [pickedTabs, setPickedTabs] = useState<Set<string>>(new Set());
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("list");
      setSelected(null);
      setTabs([]);
      setPickedTabs(new Set());
      setSearch("");
      setNeedsAuth(false);
    }
  }, [open]);

  async function loadSpreadsheets() {
    setLoading(true);
    setNeedsAuth(false);
    try {
      // Try the robust function first
      const { data, error } = await supabase.functions.invoke("google-list-sheets", { body: {} });
      if (!error && data?.spreadsheets) {
        setSpreadsheets(data.spreadsheets);
        return;
      }
      // Fallback to legacy endpoint
      const legacy = await supabase.functions.invoke("google-sheets-list", { body: {} });
      if (legacy.error) throw legacy.error;
      if (legacy.data?.needs_auth) {
        setNeedsAuth(true);
        return;
      }
      setSpreadsheets(legacy.data?.spreadsheets ?? []);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao listar planilhas";
      if (msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("reconnect")) {
        setNeedsAuth(true);
      } else {
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && step === "list") loadSpreadsheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function startGoogleAuth() {
    try {
      const redirectUri = `${window.location.origin}/relatorios-reunioes`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const json = await res.json();
      if (json.auth_url) window.location.href = json.auth_url;
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Falha ao iniciar OAuth", variant: "destructive" });
    }
  }

  async function pickSpreadsheet(s: Spreadsheet) {
    setSelected(s);
    setStep("tabs");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-read-sheet-preview", {
        body: { spreadsheetId: s.id },
      });
      if (error) {
        let detail = error.message ?? "Erro ao carregar abas";
        let requestId: string | undefined;
        try {
          const text = await (error as any)?.context?.text?.();
          if (text) {
            const parsed = JSON.parse(text);
            detail = parsed?.message ?? detail;
            requestId = parsed?.request_id;
          }
        } catch { /* ignore */ }
        throw new Error(requestId ? `${detail} (req ${requestId})` : detail);
      }
      const provider = data?.spreadsheet?.provider as "google_sheets" | "drive_xlsx" | undefined;
      setSelected({ ...s, provider, mimeType: data?.spreadsheet?.mimeType, name: data?.spreadsheet?.name ?? s.name });
      setTabs(data?.sheets ?? []);
      const first = data?.sheets?.[0]?.title;
      if (first) setPickedTabs(new Set([first]));
      if (provider === "drive_xlsx") {
        toast({ title: "Excel no Drive detectado", description: `${data?.sheets?.length ?? 0} aba(s) carregada(s).` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao carregar abas", description: err?.message ?? "Falha desconhecida", variant: "destructive" });
      setStep("list");
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleTab(title: string) {
    setPickedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  async function confirm() {
    if (!selected || pickedTabs.size === 0) return;
    try {
      await connectSheet.mutateAsync({
        spreadsheet_id: selected.id,
        spreadsheet_name: selected.name,
        selected_tabs: Array.from(pickedTabs),
        provider: selected.provider ?? "google_sheets",
      });
      toast({ title: "Fonte vinculada", description: `${selected.name} pronta para reuniões.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Não foi possível vincular", variant: "destructive" });
    }
  }

  const filtered = spreadsheets.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "tabs" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "list" ? "Selecionar planilha do Google Sheets" : `Abas de "${selected?.name}"`}
          </DialogTitle>
          <DialogDescription>
            {step === "list"
              ? "Conexão isolada do menu financeiro. Use apenas para contexto das reuniões."
              : "Escolha uma ou mais abas que servirão de contexto para esta reunião."}
          </DialogDescription>
        </DialogHeader>

        {needsAuth && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Conecte sua conta Google para listar planilhas.</p>
            <Button onClick={startGoogleAuth}>Conectar Google</Button>
          </div>
        )}

        {!needsAuth && step === "list" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-9"
              />
            </div>
            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Nenhuma planilha encontrada</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-2">
                  {filtered.map((s) => {
                    const isXlsx = s.provider === "drive_xlsx";
                    return (
                      <button
                        key={s.id}
                        onClick={() => pickSpreadsheet(s)}
                        className={cn(
                          "group relative text-left p-4 rounded-2xl border border-white/40",
                          isXlsx
                            ? "bg-gradient-to-br from-blue-50/80 via-white/60 to-blue-100/50"
                            : "bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-100/50",
                          "backdrop-blur-xl shadow-[0_4px_18px_-6px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]",
                          "transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_36px_-10px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.8)]",
                          "focus:outline-none focus-visible:ring-2",
                          isXlsx ? "focus-visible:ring-blue-400/60" : "focus-visible:ring-emerald-400/60"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                            isXlsx ? "from-blue-500 to-blue-600 shadow-blue-500/30" : "from-emerald-500 to-emerald-600 shadow-emerald-500/30"
                          )}>
                            <FileSpreadsheet className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-tight line-clamp-2 text-slate-800">{s.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                                isXlsx ? "bg-blue-500/15 text-blue-700" : "bg-emerald-500/15 text-emerald-700"
                              )}>
                                {isXlsx ? "Excel" : "Sheets"}
                              </span>
                              {(s.modified_time || s.modifiedTime) && (
                                <span className="text-[10.5px] text-muted-foreground">
                                  {new Date(s.modified_time || s.modifiedTime!).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {!needsAuth && step === "tabs" && (
          <>
            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 py-2">
                  {tabs.map((t) => {
                    const active = pickedTabs.has(t.title);
                    return (
                      <button
                        key={t.sheet_id}
                        onClick={() => toggleTab(t.title)}
                        className={cn(
                          "px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-white/60 border-black/[0.08] hover:border-primary/40 hover:bg-primary/[0.04]"
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {active && <Check className="h-3.5 w-3.5" />}
                          {t.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirm} disabled={pickedTabs.size === 0 || connectSheet.isPending}>
                {connectSheet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vincular {pickedTabs.size} aba{pickedTabs.size > 1 ? "s" : ""}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
