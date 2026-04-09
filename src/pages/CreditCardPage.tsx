import { useState, useMemo, useRef, useCallback } from "react";
import { useCreditCardDashboard } from "@/hooks/useCreditCardDashboard";
import { CreditCardHero } from "@/components/credit-card/CreditCardHero";
import { CreditCardConnectedHeader } from "@/components/credit-card/CreditCardConnectedHeader";
import { CreditCardCycleSelector } from "@/components/credit-card/CreditCardCycleSelector";
import { detectCardBrand } from "@/lib/cardCatalog";
import { formatCurrencyBR, formatCompactBR } from "@/lib/currency";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  ArrowDownRight,
  ArrowUpRight,
  ReceiptText,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
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
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  const n = Number(value || 0);
  const pct = (n * 100).toFixed(0);
  const cls = n >= 0.85 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : n >= 0.7 ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-red-400 bg-red-400/10 border-red-400/20";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls} font-medium`}>{pct}%</span>;
}

/* ── 3D Active Shape for Donut ── */
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, value, percent,
  } = props;

  return (
    <g>
      {/* Shadow layer */}
      <Sector
        cx={cx}
        cy={cy + 3}
        innerRadius={innerRadius - 1}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="rgba(0,0,0,0.35)"
        style={{ filter: "blur(6px)" }}
      />
      {/* Expanded active sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: "drop-shadow(0 0 8px " + fill + ")" }}
      />
      {/* Inner ring glow */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.5}
      />
      {/* Center label */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">
        {formatCompactBR(value)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10">
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

export default function CreditCardPage() {
  const {
    cycles, transactions, kpis, primaryBrand,
    latestCycle, isLoading, isDetecting, detect, connectionId,
  } = useCreditCardDashboard();

  const [search, setSearch] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string | "all">("__init__");
  const [showTransactions, setShowTransactions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const hasData = cycles.length > 0;

  const effectiveCycleId = selectedCycleId === "__init__"
    ? (cycles[0]?.id || "all")
    : selectedCycleId;

  const selectedCycle = effectiveCycleId === "all"
    ? null
    : cycles.find((c: any) => c.id === effectiveCycleId) || null;

  const currentBrand = selectedCycle
    ? detectCardBrand(selectedCycle.card_label)
    : primaryBrand;

  const cycleTx = useMemo(() => {
    if (effectiveCycleId === "all") return transactions;
    return transactions.filter((t: any) => t.cycle_id === effectiveCycleId);
  }, [transactions, effectiveCycleId]);

  const filteredTx = useMemo(() => {
    if (!search.trim()) return cycleTx;
    const q = search.toLowerCase();
    return cycleTx.filter((t: any) =>
      (t.original_description || "").toLowerCase().includes(q) ||
      (t.category_original || "").toLowerCase().includes(q)
    );
  }, [cycleTx, search]);

  const cycleKpis = useMemo(() => {
    if (effectiveCycleId === "all") return kpis;
    if (!selectedCycle) return kpis;
    return {
      grossAmount: Number(selectedCycle.gross_amount || 0),
      reimbursementAmount: Number(selectedCycle.reimbursement_amount || 0),
      netAmount: Number(selectedCycle.net_amount || 0),
      transactionCount: cycleTx.length,
      cycleCount: 1,
      reviewCount: kpis.reviewCount,
    };
  }, [effectiveCycleId, selectedCycle, cycleTx.length, kpis]);

  const cycleCategories = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;
    for (const t of cycleTx) {
      const cat = (t as any).category_original || "Sem categoria";
      const amt = Math.abs(Number((t as any).amount || 0));
      const existing = map.get(cat) || { total: 0, count: 0 };
      existing.total += amt;
      existing.count++;
      grandTotal += amt;
      map.set(cat, existing);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, pct: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [cycleTx]);

  const hasAnimatedRef = useRef(false);
  if (hasData) hasAnimatedRef.current = true;

  const onPieEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);

  // ─── Loading ───
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
      </div>
    );
  }

  // ─── Empty state ───
  if (!hasData && !isDetecting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-3xl w-full animate-fade-in">
          <CreditCardHero hasData={false} isDetecting={false} connectionId={connectionId} detect={detect} cycleCount={0} transactionCount={0} />
        </div>
      </div>
    );
  }

  // ─── Detecting ───
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

  const pieData = cycleCategories.slice(0, 8);

  // ─── Connected dashboard ───
  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      {/* Connected Header */}
      <CreditCardConnectedHeader
        brand={currentBrand}
        cycleName={selectedCycle?.card_label || currentBrand.name}
        dueDate={selectedCycle?.due_date || latestCycle?.due_date || null}
        netAmount={cycleKpis.netAmount}
        grossAmount={cycleKpis.grossAmount}
        reimbursementAmount={cycleKpis.reimbursementAmount}
        transactionCount={cycleKpis.transactionCount}
        isDetecting={isDetecting}
        detect={detect}
      />

      {/* Cycle Selector */}
      {cycles.length > 1 && (
        <CreditCardCycleSelector
          cycles={cycles}
          selectedId={effectiveCycleId}
          onSelect={setSelectedCycleId}
        />
      )}

      {/* Categories + Cycle Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories – 3D Donut */}
        <GlassCard className="p-6 space-y-4 min-h-[360px]">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5 text-primary" /> Categorias
            {effectiveCycleId !== "all" && selectedCycle && (
              <span className="text-xs text-muted-foreground font-normal ml-1">
                · {formatDate(selectedCycle.due_date)}
              </span>
            )}
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {pieData.length > 0 ? (
              <>
                <div className="w-52 h-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="cc-pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.3)" />
                        </filter>
                      </defs>
                      <Pie
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={pieData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={2}
                        onMouseEnter={onPieEnter}
                        isAnimationActive={!hasAnimatedRef.current}
                        animationBegin={100}
                        animationDuration={800}
                        style={{ filter: "url(#cc-pie-shadow)", cursor: "pointer" }}
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke="rgba(0,0,0,0.2)"
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 max-h-[260px] overflow-y-auto w-full pr-1">
                  {pieData.map((cat, i) => (
                    <div
                      key={cat.name}
                      className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 cursor-pointer transition-all duration-200 ${
                        activeIndex === i
                          ? "bg-white/[0.08] scale-[1.02]"
                          : "hover:bg-white/[0.04]"
                      }`}
                      onMouseEnter={() => setActiveIndex(i)}
                      title={cat.name}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                          transform: activeIndex === i ? "scale(1.3)" : "scale(1)",
                          boxShadow: activeIndex === i ? `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}` : "none",
                        }}
                      />
                      <span className="flex-1 truncate text-foreground/80">{cat.name}</span>
                      <span className="font-semibold tabular-nums text-foreground">{formatCompactBR(cat.total)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{cat.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center w-full">Nenhuma categoria detectada.</p>
            )}
          </div>
        </GlassCard>

        {/* Cycle list */}
        <GlassCard className="p-6 space-y-4 min-h-[360px]">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-primary" /> Todos os Ciclos
          </h2>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {cycles.map((cycle: any) => {
              const brand = detectCardBrand(cycle.card_label);
              const isActive = cycle.id === effectiveCycleId;
              return (
                <button
                  key={cycle.id}
                  onClick={() => setSelectedCycleId(cycle.id)}
                  className={`w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-200 text-left
                    ${isActive
                      ? "bg-primary/[0.08] border-primary/30 ring-1 ring-primary/20 scale-[1.01]"
                      : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]"
                    }
                  `}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: brand.gradient }}>
                    {brand.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{cycle.card_label || "Fatura"}</p>
                    <p className="text-xs text-muted-foreground">Venc. {formatDate(cycle.due_date)} · {cycle.transaction_count || 0} lanç.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrencyBR(Number(cycle.net_amount || 0))}</p>
                    {Number(cycle.reimbursement_amount || 0) > 0 && (
                      <p className="text-[11px] text-emerald-500">+{formatCurrencyBR(Number(cycle.reimbursement_amount))} reemb.</p>
                    )}
                  </div>
                  <ConfidenceBadge value={cycle.detection_confidence} />
                </button>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Transactions */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> Lançamentos
            {effectiveCycleId !== "all" && (
              <span className="text-xs text-muted-foreground font-normal ml-1">· {cycleTx.length} itens</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {showTransactions && (
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              {showTransactions ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </div>
        {showTransactions && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Vencimento</th>
                  <th className="text-left py-3 px-4 font-medium">Descrição</th>
                  <th className="text-left py-3 px-4 font-medium">Categoria</th>
                  <th className="text-right py-3 px-4 font-medium">Valor</th>
                  <th className="text-center py-3 px-4 font-medium">Tipo</th>
                  <th className="text-center py-3 px-4 font-medium">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{search ? "Nenhum resultado." : "Nenhum lançamento."}</td></tr>
                ) : filteredTx.map((t: any) => (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 tabular-nums text-foreground/80">{formatDate(t.due_date)}</td>
                    <td className="py-3 px-4 text-foreground max-w-[260px] truncate">{t.original_description || "—"}</td>
                    <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-foreground/70">{t.category_original || "—"}</span></td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium">
                      <span className={t.transaction_type === "reimbursement" ? "text-emerald-500" : "text-foreground"}>
                        {t.transaction_type === "reimbursement" ? "+" : ""}{formatCurrencyBR(Math.abs(Number(t.amount || 0)))}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.transaction_type === "reimbursement"
                        ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] px-2">Reembolso</Badge>
                        : <Badge variant="outline" className="text-foreground/60 border-white/[0.1] text-[10px] px-2">Despesa</Badge>}
                    </td>
                    <td className="py-3 px-4 text-center"><ConfidenceBadge value={t.detection_confidence} /></td>
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