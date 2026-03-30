import { useState, useEffect, useMemo, useCallback } from "react";
import { Building2, Save, Sparkles, Target, TrendingUp, BarChart3, Users, MapPin, Calendar, FileText, Loader2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard } from "@/components/home/GlassCard";
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

  const handleAutoFill = useCallback(async () => {
    if (!spreadsheetName) return;
    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("company-lookup", {
        body: { companyName: spreadsheetName },
      });
      if (error) throw error;
      if (data && !data.error) {
        const newForm: Partial<CompanyProfileInput> = { ...form };
        // Only fill empty fields
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
        toast({ title: "Dados preenchidos", description: `Dados inferidos a partir de "${spreadsheetName}". Revise e salve.` });
      }
    } catch (e: any) {
      console.error("Lookup error:", e);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível buscar os dados da empresa." });
    } finally {
      setIsLookingUp(false);
    }
  }, [spreadsheetName, form, toast]);

  // Sync form with loaded company
  useEffect(() => {
    if (company) {
      setForm({
        cnpj: company.cnpj,
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        setor: company.setor,
        porte: company.porte,
        regime_tributario: company.regime_tributario,
        num_funcionarios: company.num_funcionarios,
        faturamento_anual: company.faturamento_anual,
        cidade: company.cidade,
        estado: company.estado,
        ano_fundacao: company.ano_fundacao,
        meta_receita_mensal: company.meta_receita_mensal,
        meta_despesa_mensal: company.meta_despesa_mensal,
        meta_lucro_mensal: company.meta_lucro_mensal,
      });
    }
  }, [company]);

  const updateField = (field: string, value: string | number | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    upsertCompany.mutate(form);
    setDirty(false);
  };

  // KPIs derived from metrics
  const kpis = useMemo(() => ({
    margem: metrics.margin,
    receita: metrics.currentIncome,
    despesa: metrics.currentExpense,
    crescimentoReceita: metrics.incomeChange,
    despesaSobreReceita: metrics.currentIncome > 0
      ? (metrics.currentExpense / metrics.currentIncome) * 100
      : 0,
  }), [metrics]);

  const handleGenerateBenchmarks = () => {
    fetchBenchmarks({ setor: form.setor ?? null, porte: form.porte ?? null, kpis });
  };

  // Goal progress
  const goalProgress = useMemo(() => {
    const metaReceita = form.meta_receita_mensal ?? 0;
    const metaDespesa = form.meta_despesa_mensal ?? 0;
    const metaLucro = form.meta_lucro_mensal ?? 0;
    return {
      receita: metaReceita > 0 ? Math.min((metrics.currentIncome / metaReceita) * 100, 150) : 0,
      despesa: metaDespesa > 0 ? Math.min((metrics.currentExpense / metaDespesa) * 100, 150) : 0,
      lucro: metaLucro > 0 ? Math.min((metrics.currentBalance / metaLucro) * 100, 150) : 0,
      metaReceita,
      metaDespesa,
      metaLucro,
    };
  }, [form, metrics]);

  const benchmark = benchmarkResult?.benchmark;

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha Empresa</h1>
            <p className="text-sm text-muted-foreground">Perfil empresarial, metas e benchmarks de mercado</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!dirty || upsertCompany.isPending} className="gap-2">
          {upsertCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Profile Form ── */}
        <div className="space-y-6">
          {/* Company Info */}
          <GlassCard>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Dados Cadastrais</h2>
                </div>
                {spreadsheetName && !company?.razao_social && (
                  <Button size="sm" variant="outline" onClick={handleAutoFill} disabled={isLookingUp} className="gap-1.5 text-xs">
                    {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Preencher com "{spreadsheetName.length > 20 ? spreadsheetName.slice(0, 20) + '…' : spreadsheetName}"
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={form.cnpj ?? ""} onChange={e => updateField("cnpj", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Razão Social</Label>
                  <Input placeholder="Razão Social Ltda" value={form.razao_social ?? ""} onChange={e => updateField("razao_social", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                  <Input placeholder="Nome Fantasia" value={form.nome_fantasia ?? ""} onChange={e => updateField("nome_fantasia", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Setor</Label>
                  <Select value={form.setor ?? ""} onValueChange={v => updateField("setor", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Porte</Label>
                  <Select value={form.porte ?? "ME"} onValueChange={v => updateField("porte", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PORTES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Regime Tributário</Label>
                  <Select value={form.regime_tributario ?? ""} onValueChange={v => updateField("regime_tributario", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Funcionários</Label>
                  <Input type="number" placeholder="0" value={form.num_funcionarios ?? ""} onChange={e => updateField("num_funcionarios", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Faturamento Anual</Label>
                  <Input type="number" placeholder="0" value={form.faturamento_anual ?? ""} onChange={e => updateField("faturamento_anual", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Ano de Fundação</Label>
                  <Input type="number" placeholder="2020" value={form.ano_fundacao ?? ""} onChange={e => updateField("ano_fundacao", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Cidade</Label>
                  <Input placeholder="Cidade" value={form.cidade ?? ""} onChange={e => updateField("cidade", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={form.estado ?? ""} onValueChange={v => updateField("estado", v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Financial Goals */}
          <GlassCard variant="highlight">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Metas Financeiras Mensais</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Meta Receita (R$)</Label>
                  <Input type="number" placeholder="0" value={form.meta_receita_mensal ?? ""} onChange={e => updateField("meta_receita_mensal", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Limite Despesa (R$)</Label>
                  <Input type="number" placeholder="0" value={form.meta_despesa_mensal ?? ""} onChange={e => updateField("meta_despesa_mensal", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Meta Lucro (R$)</Label>
                  <Input type="number" placeholder="0" value={form.meta_lucro_mensal ?? ""} onChange={e => updateField("meta_lucro_mensal", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* ── RIGHT: Benchmarks & Goals ── */}
        <div className="space-y-6">
          {/* Goal Progress */}
          {(goalProgress.metaReceita > 0 || goalProgress.metaDespesa > 0 || goalProgress.metaLucro > 0) && (
            <GlassCard>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Progresso vs Metas</h2>
                </div>

                <div className="space-y-4">
                  {goalProgress.metaReceita > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="font-medium">{formatCurrencyBR(metrics.currentIncome)} / {formatCurrencyBR(goalProgress.metaReceita)}</span>
                      </div>
                      <Progress value={Math.min(goalProgress.receita, 100)} className="h-2.5" />
                      <span className={`text-xs ${goalProgress.receita >= 100 ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {goalProgress.receita.toFixed(1)}% da meta
                      </span>
                    </div>
                  )}
                  {goalProgress.metaDespesa > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Despesa</span>
                        <span className="font-medium">{formatCurrencyBR(metrics.currentExpense)} / {formatCurrencyBR(goalProgress.metaDespesa)}</span>
                      </div>
                      <Progress value={Math.min(goalProgress.despesa, 100)} className="h-2.5" />
                      <span className={`text-xs ${goalProgress.despesa > 100 ? "text-red-500" : "text-emerald-500"}`}>
                        {goalProgress.despesa.toFixed(1)}% do limite {goalProgress.despesa > 100 ? "⚠️ Acima" : "✅ Dentro"}
                      </span>
                    </div>
                  )}
                  {goalProgress.metaLucro > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Lucro</span>
                        <span className="font-medium">{formatCurrencyBR(metrics.currentBalance)} / {formatCurrencyBR(goalProgress.metaLucro)}</span>
                      </div>
                      <Progress value={Math.min(goalProgress.lucro, 100)} className="h-2.5" />
                      <span className={`text-xs ${goalProgress.lucro >= 100 ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {goalProgress.lucro.toFixed(1)}% da meta
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* KPIs vs Market */}
          <GlassCard>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Seus KPIs vs Mercado</h2>
                </div>
                <Button size="sm" variant="outline" onClick={handleGenerateBenchmarks} disabled={loadingBenchmarks} className="gap-1.5 text-xs">
                  {loadingBenchmarks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  {benchmark ? "Atualizar" : "Comparar"}
                </Button>
              </div>

              {benchmark ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Comparando com: <span className="font-medium text-foreground">{benchmarkResult?.setor} — {benchmarkResult?.porte}</span></p>

                  {/* Margem */}
                  <BenchmarkBar
                    label="Margem Líquida"
                    userValue={kpis.margem}
                    marketValue={benchmark.margem_liquida}
                    suffix="%"
                    higherIsBetter
                  />
                  {/* Crescimento */}
                  <BenchmarkBar
                    label="Crescimento Receita"
                    userValue={kpis.crescimentoReceita}
                    marketValue={benchmark.crescimento_anual}
                    suffix="%"
                    higherIsBetter
                  />
                  {/* Despesas / Receita */}
                  <BenchmarkBar
                    label="Despesas / Receita"
                    userValue={kpis.despesaSobreReceita}
                    marketValue={benchmark.despesas_sobre_faturamento}
                    suffix="%"
                    higherIsBetter={false}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Preencha os dados da empresa e clique em "Comparar"<br />para ver como você está em relação ao mercado.</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* AI Insights */}
          <GlassCard variant="highlight">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Insights IA</h2>
              </div>

              {benchmarkResult?.aiInsights ? (
                <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                  {benchmarkResult.aiInsights}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Clique em "Comparar" acima para gerar<br />insights personalizados com IA.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/* ── Benchmark comparison bar ── */
function BenchmarkBar({ label, userValue, marketValue, suffix, higherIsBetter }: {
  label: string;
  userValue: number;
  marketValue: number;
  suffix: string;
  higherIsBetter: boolean;
}) {
  const maxVal = Math.max(Math.abs(userValue), Math.abs(marketValue), 1);
  const userWidth = Math.min((Math.abs(userValue) / maxVal) * 100, 100);
  const marketWidth = Math.min((Math.abs(marketValue) / maxVal) * 100, 100);

  const userBetter = higherIsBetter ? userValue >= marketValue : userValue <= marketValue;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${userBetter ? "text-emerald-500" : "text-amber-500"}`}>
          {userValue.toFixed(1)}{suffix} vs {marketValue.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12">Você</span>
          <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${userBetter ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${userWidth}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-12">Mercado</span>
          <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full bg-primary/40 transition-all duration-500" style={{ width: `${marketWidth}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
