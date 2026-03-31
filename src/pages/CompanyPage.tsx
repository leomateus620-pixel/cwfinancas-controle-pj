import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building2, Save, Target, TrendingUp, TrendingDown, BarChart3, Users, MapPin,
  Calendar, FileText, Loader2, Wand2, DollarSign, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, Activity, Percent, AlertTriangle, CheckCircle2, MinusCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCompanyProfile, type CompanyProfileInput } from "@/hooks/useCompanyProfile";
import { useCompanyBenchmarks } from "@/hooks/useCompanyBenchmarks";
import { usePeriodMetrics } from "@/hooks/usePeriodMetrics";
import { formatCurrencyBR } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SETORES = [
  "Comércio", "Serviços", "Indústria", "Tecnologia", "Alimentação",
  "Saúde", "Construção", "Educação", "Agronegócio", "Transporte e Logística",
];
const PORTES = ["MEI", "ME", "EPP"];
const REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"];
const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/* ── SVG Gauge Ring ── */
function GaugeRing({ percent, color, size = 120, strokeWidth = 10 }: {
  percent: number; color: string; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 150));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" className="text-white/[0.06]" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out" />
    </svg>
  );
}

/* ── Benchmark Bar ── */
function BenchmarkBar({ label, userValue, marketValue, suffix, higherIsBetter, microcopy }: {
  label: string; userValue: number; marketValue: number; suffix: string;
  higherIsBetter: boolean; microcopy?: string;
}) {
  const maxVal = Math.max(Math.abs(userValue), Math.abs(marketValue), 1);
  const userWidth = Math.min((Math.abs(userValue) / maxVal) * 100, 100);
  const marketWidth = Math.min((Math.abs(marketValue) / maxVal) * 100, 100);
  const userBetter = higherIsBetter ? userValue >= marketValue : userValue <= marketValue;
  const diff = userValue - marketValue;
  const diffStr = diff > 0 ? `+${Math.abs(diff).toFixed(1)}${suffix}` : `${diff.toFixed(1)}${suffix}`;

  return (
    <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          {userBetter
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          <span className={`font-semibold ${userBetter ? "text-emerald-400" : "text-amber-400"}`}>
            {diffStr} vs mercado
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Sua empresa</span>
          <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${userBetter ? "bg-emerald-500/80" : "bg-amber-500/80"}`}
              style={{ width: `${userWidth}%` }} />
          </div>
          <span className="text-[10px] font-medium w-12 text-right">{userValue.toFixed(1)}{suffix}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Mercado</span>
          <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-primary/30 transition-all duration-700 ease-out"
              style={{ width: `${marketWidth}%` }} />
          </div>
          <span className="text-[10px] font-medium w-12 text-right">{marketValue.toFixed(1)}{suffix}</span>
        </div>
      </div>
      {microcopy && <p className="text-[10px] text-muted-foreground/70 mt-1">{microcopy}</p>}
    </div>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: "above" | "within" | "below" }) {
  const config = {
    above: { label: "Acima da média", icon: TrendingUp, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    within: { label: "Dentro da faixa", icon: MinusCircle, cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    below: { label: "Abaixo da média", icon: TrendingDown, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  }[status];
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${config.cls}`}>
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </div>
  );
}

/* ── Mini KPI Card ── */
function MiniKPI({ icon: Icon, label, value, change, changeLabel, color }: {
  icon: any; label: string; value: string; change: number; changeLabel: string; color: string;
}) {
  const positive = change >= 0;
  return (
    <div className="liquid-glass-kpi p-4 rounded-2xl space-y-2 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <div className="flex items-center gap-1 text-xs">
        {positive ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
        <span className={positive ? "text-emerald-400" : "text-red-400"}>{Math.abs(change).toFixed(1)}%</span>
        <span className="text-muted-foreground">{changeLabel}</span>
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { company, isLoading: loadingProfile, upsertCompany } = useCompanyProfile();
  const { data: benchmarkResult, isLoading: loadingBenchmarks, fetchBenchmarks } = useCompanyBenchmarks();
  const metrics = usePeriodMetrics();

  const [form, setForm] = useState<Partial<CompanyProfileInput>>({});
  const [dirty, setDirty] = useState(false);
  const [spreadsheetName, setSpreadsheetName] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  // Fetch connected spreadsheet name
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("google_sheet_connections")
      .select("spreadsheet_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.spreadsheet_name) {
          setSpreadsheetName(data[0].spreadsheet_name);
        }
      });
  }, [user?.id]);

  // Extract company name before first hyphen
  const extractedCompanyName = useMemo(() => {
    if (!spreadsheetName) return null;
    const parts = spreadsheetName.split("-");
    return parts[0].trim();
  }, [spreadsheetName]);

  const handleAutoFill = useCallback(async () => {
    if (!extractedCompanyName) return;
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("company-lookup", {
        body: { companyName: extractedCompanyName },
      });
      if (error) throw error;
      if (data && !data.error) {
        const newForm: Partial<CompanyProfileInput> = { ...form };
        if (!form.razao_social && data.razao_social) newForm.razao_social = data.razao_social;
        if (!form.nome_fantasia && data.nome_fantasia) newForm.nome_fantasia = data.nome_fantasia;
        if (!form.cnpj && data.cnpj) newForm.cnpj = data.cnpj;
        if (!form.setor && data.setor) newForm.setor = data.setor;
        if (!form.porte && data.porte) newForm.porte = data.porte;
        if (!form.regime_tributario && data.regime_tributario) newForm.regime_tributario = data.regime_tributario;
        if (!form.cidade && data.cidade) newForm.cidade = data.cidade;
        if (!form.estado && data.estado) newForm.estado = data.estado;
        if (!form.ano_fundacao && data.ano_fundacao) newForm.ano_fundacao = data.ano_fundacao;
        setForm(newForm);
        setDirty(true);
        toast({ title: "Dados preenchidos", description: `Dados inferidos a partir de "${extractedCompanyName}". Revise e salve.` });
      }
    } catch (e: any) {
      console.error("Lookup error:", e);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível buscar os dados da empresa." });
    } finally {
      setIsLookingUp(false);
    }
  }, [extractedCompanyName, form, toast]);

  // Sync form with loaded company
  useEffect(() => {
    if (company) {
      setForm({
        cnpj: company.cnpj, razao_social: company.razao_social, nome_fantasia: company.nome_fantasia,
        setor: company.setor, porte: company.porte, regime_tributario: company.regime_tributario,
        num_funcionarios: company.num_funcionarios, faturamento_anual: company.faturamento_anual,
        cidade: company.cidade, estado: company.estado, ano_fundacao: company.ano_fundacao,
        meta_receita_mensal: company.meta_receita_mensal, meta_despesa_mensal: company.meta_despesa_mensal,
        meta_lucro_mensal: company.meta_lucro_mensal,
      });
    }
  }, [company]);

  const updateField = (field: string, value: string | number | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => { upsertCompany.mutate(form); setDirty(false); };

  const kpis = useMemo(() => ({
    margem: metrics.margin,
    receita: metrics.currentIncome,
    despesa: metrics.currentExpense,
    crescimentoReceita: metrics.incomeChange,
    despesaSobreReceita: metrics.currentIncome > 0 ? (metrics.currentExpense / metrics.currentIncome) * 100 : 0,
  }), [metrics]);

  const handleGenerateBenchmarks = () => {
    fetchBenchmarks({ setor: form.setor ?? null, porte: form.porte ?? null, kpis });
  };

  const goalProgress = useMemo(() => {
    const metaReceita = form.meta_receita_mensal ?? 0;
    const metaDespesa = form.meta_despesa_mensal ?? 0;
    const metaLucro = form.meta_lucro_mensal ?? 0;
    return {
      receita: metaReceita > 0 ? (metrics.currentIncome / metaReceita) * 100 : 0,
      despesa: metaDespesa > 0 ? (metrics.currentExpense / metaDespesa) * 100 : 0,
      lucro: metaLucro > 0 ? (metrics.currentBalance / metaLucro) * 100 : 0,
      metaReceita, metaDespesa, metaLucro,
      deltaReceita: metaReceita > 0 ? metrics.currentIncome - metaReceita : 0,
      deltaDespesa: metaDespesa > 0 ? metrics.currentExpense - metaDespesa : 0,
      deltaLucro: metaLucro > 0 ? metrics.currentBalance - metaLucro : 0,
    };
  }, [form, metrics]);

  const benchmark = benchmarkResult?.benchmark;

  // Overall benchmark status
  const overallStatus = useMemo(() => {
    if (!benchmark) return null;
    let score = 0;
    if (kpis.margem >= benchmark.margem_liquida) score++;
    if (kpis.crescimentoReceita >= benchmark.crescimento_anual) score++;
    if (kpis.despesaSobreReceita <= benchmark.despesas_sobre_faturamento) score++;
    if (score >= 2) return "above" as const;
    if (score === 1) return "within" as const;
    return "below" as const;
  }, [benchmark, kpis]);

  const hasGoals = goalProgress.metaReceita > 0 || goalProgress.metaDespesa > 0 || goalProgress.metaLucro > 0;

  // Gauge helpers
  const getGaugeColor = (percent: number, isExpense = false) => {
    if (isExpense) {
      if (percent > 100) return "#ef4444";
      if (percent > 85) return "#f59e0b";
      return "#22c55e";
    }
    if (percent >= 100) return "#22c55e";
    if (percent >= 70) return "#3b82f6";
    return "#f59e0b";
  };

  const getGaugeMicrocopy = (type: "receita" | "despesa" | "lucro", percent: number) => {
    const p = Math.min(percent, 999).toFixed(1);
    if (type === "receita") {
      if (percent >= 100) return `✅ Meta atingida — ${p}% da receita prevista`;
      if (percent >= 70) return `Em progresso — ${p}% da meta de receita`;
      return `Atenção — apenas ${p}% da meta de receita atingida`;
    }
    if (type === "despesa") {
      if (percent > 100) return `⚠️ Acima do limite — ${p}% do teto de despesas`;
      if (percent > 85) return `Próximo do limite — ${p}% do teto consumido`;
      return `✅ Dentro do limite — ${p}% do teto de despesas`;
    }
    if (percent >= 100) return `✅ Lucro acima da meta — ${p}% atingido`;
    if (percent >= 50) return `Em progresso — ${p}% da meta de lucro`;
    return `Atenção — ${p}% da meta de lucro`;
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 w-full max-w-2xl px-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="liquid-glass-card p-6 rounded-2xl animate-pulse">
              <div className="h-4 bg-white/[0.08] rounded w-1/3 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-white/[0.06] rounded w-full" />
                <div className="h-3 bg-white/[0.06] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-lg shadow-primary/5">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {form.nome_fantasia || "Minha Empresa"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {form.setor ? `${form.setor} • ${form.porte || ""}` : "Painel empresarial e benchmarks de mercado"}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!dirty || upsertCompany.isPending}
          className="gap-2 rounded-xl shadow-lg">
          {upsertCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      {/* ═══ ROW 1: Profile + Benchmark ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Dados Cadastrais ── */}
        <div className="liquid-glass-card rounded-2xl p-6 space-y-5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Dados Cadastrais</h2>
            </div>
            {extractedCompanyName && !company?.razao_social && (
              <Button size="sm" variant="outline" onClick={handleAutoFill} disabled={isLookingUp}
                className="gap-1.5 text-xs rounded-xl border-primary/20 hover:bg-primary/5">
                {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Preencher com "{extractedCompanyName.length > 18 ? extractedCompanyName.slice(0, 18) + '…' : extractedCompanyName}"
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" value={form.cnpj ?? ""} onChange={e => updateField("cnpj", e.target.value)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Razão Social</Label>
              <Input placeholder="Razão Social" value={form.razao_social ?? ""} onChange={e => updateField("razao_social", e.target.value)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
              <Input placeholder="Nome Fantasia" value={form.nome_fantasia ?? ""} onChange={e => updateField("nome_fantasia", e.target.value)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Select value={form.setor ?? ""} onValueChange={v => updateField("setor", v)}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Porte</Label>
              <Select value={form.porte ?? "ME"} onValueChange={v => updateField("porte", v)}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]"><SelectValue /></SelectTrigger>
                <SelectContent>{PORTES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Regime Tributário</Label>
              <Select value={form.regime_tributario ?? ""} onValueChange={v => updateField("regime_tributario", v)}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Funcionários</Label>
              <Input type="number" placeholder="0" value={form.num_funcionarios ?? ""} onChange={e => updateField("num_funcionarios", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Faturamento Anual</Label>
              <Input type="number" placeholder="0" value={form.faturamento_anual ?? ""} onChange={e => updateField("faturamento_anual", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Ano de Fundação</Label>
              <Input type="number" placeholder="2020" value={form.ano_fundacao ?? ""} onChange={e => updateField("ano_fundacao", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Cidade</Label>
              <Input placeholder="Cidade" value={form.cidade ?? ""} onChange={e => updateField("cidade", e.target.value)} className="bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={form.estado ?? ""} onValueChange={v => updateField("estado", v)}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08]"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Benchmark ── */}
        <div className="liquid-glass-card rounded-2xl p-6 space-y-5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Mercado &amp; Benchmark</h2>
            </div>
            <Button size="sm" variant="outline" onClick={handleGenerateBenchmarks} disabled={loadingBenchmarks}
              className="gap-1.5 text-xs rounded-xl border-primary/20 hover:bg-primary/5">
              {loadingBenchmarks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {benchmark ? "Atualizar" : "Comparar"}
            </Button>
          </div>

          {benchmark ? (
            <div className="space-y-4">
              {/* Status badge + source */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {overallStatus && <StatusBadge status={overallStatus} />}
                <p className="text-[10px] text-muted-foreground/60">
                  Ref: SEBRAE/IBGE — {benchmarkResult?.setor} — {benchmarkResult?.porte}
                </p>
              </div>

              <BenchmarkBar label="Margem Líquida" userValue={kpis.margem} marketValue={benchmark.margem_liquida}
                suffix="%" higherIsBetter microcopy={kpis.margem >= benchmark.margem_liquida
                  ? `Margem ${(kpis.margem - benchmark.margem_liquida).toFixed(1)}pp acima da referência do setor`
                  : `Margem ${(benchmark.margem_liquida - kpis.margem).toFixed(1)}pp abaixo da referência do setor`} />

              <BenchmarkBar label="Crescimento Receita" userValue={kpis.crescimentoReceita} marketValue={benchmark.crescimento_anual}
                suffix="%" higherIsBetter microcopy={kpis.crescimentoReceita >= benchmark.crescimento_anual
                  ? "Crescimento acima da média setorial"
                  : "Crescimento abaixo da média setorial"} />

              <BenchmarkBar label="Despesas / Receita" userValue={kpis.despesaSobreReceita} marketValue={benchmark.despesas_sobre_faturamento}
                suffix="%" higherIsBetter={false} microcopy={kpis.despesaSobreReceita <= benchmark.despesas_sobre_faturamento
                  ? "Eficiência operacional dentro da faixa saudável"
                  : "Despesa operacional acima da faixa recomendada"} />

              {benchmark.descricao && (
                <p className="text-xs text-muted-foreground/70 border-t border-white/[0.06] pt-3 leading-relaxed">
                  {benchmark.descricao}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium mb-1">Benchmark setorial indisponível</p>
              <p className="text-xs text-muted-foreground/60">Preencha setor e porte, depois clique em "Comparar"</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ROW 2: Metas Financeiras ═══ */}
      <div className="liquid-glass-card-hero rounded-2xl p-6 space-y-5 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Metas Financeiras Mensais</h2>
          </div>
          <Collapsible open={goalsOpen} onOpenChange={setGoalsOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted-foreground">
                {goalsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Editar metas
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Gauges */}
        {hasGoals ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {goalProgress.metaReceita > 0 && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="relative">
                  <GaugeRing percent={goalProgress.receita} color={getGaugeColor(goalProgress.receita)} size={130} strokeWidth={12} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{Math.min(goalProgress.receita, 999).toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground">receita</span>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">{formatCurrencyBR(metrics.currentIncome)}</p>
                  <p className="text-[10px] text-muted-foreground">Meta: {formatCurrencyBR(goalProgress.metaReceita)}</p>
                  <p className="text-[10px] text-muted-foreground/70">{getGaugeMicrocopy("receita", goalProgress.receita)}</p>
                </div>
              </div>
            )}

            {goalProgress.metaDespesa > 0 && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="relative">
                  <GaugeRing percent={goalProgress.despesa} color={getGaugeColor(goalProgress.despesa, true)} size={130} strokeWidth={12} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{Math.min(goalProgress.despesa, 999).toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground">despesa</span>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">{formatCurrencyBR(metrics.currentExpense)}</p>
                  <p className="text-[10px] text-muted-foreground">Limite: {formatCurrencyBR(goalProgress.metaDespesa)}</p>
                  <p className="text-[10px] text-muted-foreground/70">{getGaugeMicrocopy("despesa", goalProgress.despesa)}</p>
                </div>
              </div>
            )}

            {goalProgress.metaLucro > 0 && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="relative">
                  <GaugeRing percent={goalProgress.lucro} color={getGaugeColor(goalProgress.lucro)} size={130} strokeWidth={12} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{Math.min(goalProgress.lucro, 999).toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground">lucro</span>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">{formatCurrencyBR(metrics.currentBalance)}</p>
                  <p className="text-[10px] text-muted-foreground">Meta: {formatCurrencyBR(goalProgress.metaLucro)}</p>
                  <p className="text-[10px] text-muted-foreground/70">{getGaugeMicrocopy("lucro", goalProgress.lucro)}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium mb-1">Nenhuma meta definida</p>
            <p className="text-xs text-muted-foreground/60">Clique em "Editar metas" para configurar suas metas mensais</p>
          </div>
        )}

        {/* Collapsible goal inputs */}
        <Collapsible open={goalsOpen} onOpenChange={setGoalsOpen}>
          <CollapsibleContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meta Receita (R$)</Label>
                <Input type="number" placeholder="0" value={form.meta_receita_mensal ?? ""} onChange={e => updateField("meta_receita_mensal", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Limite Despesa (R$)</Label>
                <Input type="number" placeholder="0" value={form.meta_despesa_mensal ?? ""} onChange={e => updateField("meta_despesa_mensal", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meta Lucro (R$)</Label>
                <Input type="number" placeholder="0" value={form.meta_lucro_mensal ?? ""} onChange={e => updateField("meta_lucro_mensal", e.target.value ? Number(e.target.value) : null)} className="bg-white/[0.04] border-white/[0.08]" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ═══ ROW 3: Resumo Financeiro ═══ */}
      {!metrics.isLoading && metrics.transactionCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniKPI icon={ArrowUpRight} label="Receita do Período" value={formatCurrencyBR(metrics.currentIncome)}
            change={metrics.incomeChange} changeLabel="vs período anterior" color="bg-emerald-500/10 text-emerald-400" />
          <MiniKPI icon={ArrowDownRight} label="Despesa do Período" value={formatCurrencyBR(metrics.currentExpense)}
            change={metrics.expenseChange} changeLabel="vs período anterior" color="bg-red-500/10 text-red-400" />
          <MiniKPI icon={Activity} label="Resultado Líquido" value={formatCurrencyBR(metrics.currentBalance)}
            change={metrics.balanceChange} changeLabel="vs período anterior"
            color={metrics.currentBalance >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"} />
        </div>
      )}

      {/* Margem estimada */}
      {!metrics.isLoading && metrics.currentIncome > 0 && (
        <div className="liquid-glass-kpi rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Margem Estimada do Período</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${metrics.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {metrics.margin.toFixed(1)}%
            </span>
            {metrics.marginChange !== 0 && (
              <span className={`text-xs ${metrics.marginChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {metrics.marginChange > 0 ? "+" : ""}{metrics.marginChange.toFixed(1)}pp
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
