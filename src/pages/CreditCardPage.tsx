import { useState, useMemo, useRef } from "react";
import { useCreditCardDashboard } from "@/hooks/useCreditCardDashboard";
import { CreditCardHero } from "@/components/credit-card/CreditCardHero";
import { detectCardBrand } from "@/lib/cardCatalog";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Search,
  Loader2,
  ArrowDownRight,
  ArrowUpRight,
  ReceiptText,
  Wallet,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingDown,
  Clock,
  Layers,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PIE_COLORS = [
  "hsl(221, 85%, 53%)",
  "hsl(160, 84%, 39%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(173, 80%, 40%)",
  "hsl(0, 72%, 51%)",
  "hsl(199, 89%, 48%)",
  "hsl(340, 75%, 55%)",
];

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function KPICard({ icon, label, value, color, bgColor }: { icon: React.ReactNode; label: string; value: string; color: string; bgColor: string }) {
  return (
    <div className="liquid-glass rounded-2xl p-5 space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor} ${color}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  const n = Number(value || 0);
  const pct = (n * 100).toFixed(0);
  const cls = n >= 0.85 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : n >= 0.7 ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-red-400 bg-red-400/10 border-red-400/20";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls} font-medium`}>{pct}%</span>;
}

export default function CreditCardPage() {
  const { cycles, transactions, reviewItems, kpis, categories, primaryBrand, latestCycle, isLoading, isDetecting, detect, reviewItem, connectionId } = useCreditCardDashboard();
  const [search, setSearch] = useState("");

  const filteredTx = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((t: any) => (t.original_description || "").toLowerCase().includes(q) || (t.category_original || "").toLowerCase().includes(q));
  }, [transactions, search]);

  const hasData = cycles.length > 0;
  const hasAnimatedRef = useRef(false);
  if (hasData) hasAnimatedRef.current = true;

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 animate-fade-in">
        <div className="liquid-glass rounded-2xl p-8 flex items-center gap-6">
          <div className="w-[340px] h-[215px] rounded-2xl bg-white/[0.06] animate-pulse" />
          <div className="flex-1 space-y-4">
            <div className="h-8 w-64 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-4 w-96 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-10 w-48 bg-white/[0.06] rounded-xl animate-pulse mt-6" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="liquid-glass rounded-2xl p-5 h-28 animate-pulse" />))}
        </div>
      </div>
    );
  }

  if (!hasData && !isDetecting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="liquid-glass rounded-3xl p-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
          <div className="mx-auto"><CreditCard3D brand={primaryBrand} className="mx-auto" /></div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Cartão de Crédito</h1>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
              Detecte automaticamente os lançamentos de cartão corporativo nas suas planilhas. O sistema identifica blocos de fatura, separa despesas de reembolsos e consolida tudo aqui.
            </p>
          </div>
          <Button size="lg" className="gap-2 text-base px-8 py-3 rounded-xl shadow-lg" onClick={() => detect()} disabled={isDetecting || !connectionId}>
            {isDetecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Detectar Lançamentos
          </Button>
          {!connectionId && <p className="text-xs text-muted-foreground/60">Conecte uma planilha primeiro para detectar lançamentos.</p>}
        </div>
      </div>
    );
  }

  if (isDetecting && !hasData) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="liquid-glass rounded-3xl p-10 max-w-lg w-full text-center space-y-6 animate-fade-in">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Processando planilhas...</h2>
          <p className="text-sm text-muted-foreground">Detectando blocos de cartão, classificando lançamentos e consolidando faturas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      {/* HERO */}
      <div className="liquid-glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
        <CreditCard3D brand={primaryBrand} totalNet={kpis.netAmount} dueDate={latestCycle ? formatDate(latestCycle.due_date) : undefined} cycleLabel={latestCycle?.card_label || undefined} />
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cartão de Crédito</h1>
            <p className="text-muted-foreground mt-1">Consolidação das faturas corporativas detectadas nas planilhas</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => detect()} disabled={isDetecting}>
              <RefreshCw className={`h-4 w-4 ${isDetecting ? "animate-spin" : ""}`} /> Reprocessar
            </Button>
            {latestCycle && (
              <Badge variant="secondary" className="gap-1 px-3 py-1 text-xs rounded-full">
                <Clock className="h-3 w-3" /> Vencimento: {formatDate(latestCycle.due_date)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard icon={<Wallet className="h-5 w-5" />} label="Fatura Líquida" value={formatCompactBR(kpis.netAmount)} color="text-primary" bgColor="bg-primary/10" />
        <KPICard icon={<TrendingDown className="h-5 w-5" />} label="Despesas Brutas" value={formatCompactBR(kpis.grossAmount)} color="text-red-500" bgColor="bg-red-500/10" />
        <KPICard icon={<ArrowUpRight className="h-5 w-5" />} label="Reembolsos" value={formatCompactBR(kpis.reimbursementAmount)} color="text-emerald-500" bgColor="bg-emerald-500/10" />
        <KPICard icon={<ReceiptText className="h-5 w-5" />} label="Lançamentos" value={String(kpis.transactionCount)} color="text-blue-500" bgColor="bg-blue-500/10" />
        <KPICard icon={<CreditCard className="h-5 w-5" />} label="Faturas" value={String(kpis.cycleCount)} color="text-violet-500" bgColor="bg-violet-500/10" />
      </div>

      {/* CYCLES + CATEGORIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Faturas por Ciclo</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {cycles.map((cycle: any) => {
              const brand = detectCardBrand(cycle.card_label);
              return (
                <div key={cycle.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: brand.gradient }}>{brand.name.substring(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{cycle.card_label || "Fatura"}</p>
                    <p className="text-xs text-muted-foreground">Venc. {formatDate(cycle.due_date)} · {cycle.transaction_count || 0} lançamentos</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrencyBR(Number(cycle.net_amount || 0))}</p>
                    {Number(cycle.reimbursement_amount || 0) > 0 && <p className="text-[11px] text-emerald-500">+{formatCurrencyBR(Number(cycle.reimbursement_amount))} reemb.</p>}
                  </div>
                  <ConfidenceBadge value={cycle.detection_confidence} />
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><ArrowDownRight className="h-5 w-5 text-primary" /> Categorias</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            {categories.length > 0 ? (
              <>
                <div className="w-44 h-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories.slice(0, 8)} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} isAnimationActive={!hasAnimatedRef.current}>
                        {categories.slice(0, 8).map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrencyBR(v)} contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto w-full">
                  {categories.slice(0, 8).map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate text-foreground/80">{cat.name}</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCompactBR(cat.total)}</span>
                      <span className="text-xs text-muted-foreground">({cat.count})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center w-full">Nenhuma categoria detectada ainda.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* TRANSACTIONS */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Lançamentos</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descrição ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-3 font-medium">Vencimento</th>
                <th className="text-left py-3 px-3 font-medium">Descrição</th>
                <th className="text-left py-3 px-3 font-medium">Categoria</th>
                <th className="text-right py-3 px-3 font-medium">Valor</th>
                <th className="text-center py-3 px-3 font-medium">Tipo</th>
                <th className="text-center py-3 px-3 font-medium">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{search ? "Nenhum resultado encontrado." : "Nenhum lançamento detectado."}</td></tr>
              ) : filteredTx.map((t: any) => (
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="py-2.5 px-3 tabular-nums text-foreground/80">{formatDate(t.due_date)}</td>
                  <td className="py-2.5 px-3 text-foreground max-w-[250px] truncate">{t.original_description || "—"}</td>
                  <td className="py-2.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground/70">{t.category_original || "—"}</span></td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                    <span className={t.transaction_type === "reimbursement" ? "text-emerald-500" : "text-foreground"}>
                      {t.transaction_type === "reimbursement" ? "+" : ""}{formatCurrencyBR(Math.abs(Number(t.amount || 0)))}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {t.transaction_type === "reimbursement"
                      ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] px-2">Reembolso</Badge>
                      : <Badge variant="outline" className="text-foreground/60 border-white/[0.1] text-[10px] px-2">Despesa</Badge>}
                  </td>
                  <td className="py-2.5 px-3 text-center"><ConfidenceBadge value={t.detection_confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* REVIEW QUEUE */}
      {reviewItems.length > 0 && (
        <GlassCard className="p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Revisão Pendente
            <Badge variant="secondary" className="ml-2 text-xs">{reviewItems.length}</Badge>
          </h2>
          <div className="space-y-3">
            {reviewItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">Aba: {item.source_tab} · Linha {item.source_row_number}</p>
                  <p className="text-xs text-muted-foreground">{item.reason_flag || "Confiança baixa"} · Score: {((item.confidence || 0) * 100).toFixed(0)}%</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => reviewItem({ id: item.id, decision: "approved" })}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => reviewItem({ id: item.id, decision: "rejected" })}>
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
