import { useState } from "react";
import { CreditCard, RefreshCw, Search, CheckCircle2, XCircle, AlertTriangle, Receipt, ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { useCreditCardDashboard } from "@/hooks/useCreditCardDashboard";
import { formatBRL } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(221, 85%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)",
  "hsl(24, 95%, 53%)", "hsl(330, 81%, 60%)", "hsl(172, 66%, 50%)",
  "hsl(47, 96%, 53%)",
];

export default function CreditCardPage() {
  const {
    cycles, transactions, reviewItems, kpis, categories,
    isLoading, isDetecting, detect, reviewItem, connectionId,
  } = useCreditCardDashboard();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "reimbursement">("all");

  const filteredTxns = transactions.filter((t: any) => {
    const matchSearch = !search || 
      (t.original_description || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.category_original || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || t.transaction_type === filterType;
    return matchSearch && matchType;
  });

  if (!connectionId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="liquid-glass p-8 rounded-2xl max-w-md">
          <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Nenhuma planilha conectada</h2>
          <p className="text-sm text-muted-foreground">
            Conecte uma planilha no menu Google Sheets para detectar lançamentos de cartão.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Cartão de Crédito
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faturas corporativas consolidadas a partir das planilhas
          </p>
        </div>
        <Button
          onClick={() => detect()}
          disabled={isDetecting}
          className="gap-2 liquid-glass-highlight border-0 text-primary hover:text-primary/80"
        >
          {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isDetecting ? "Detectando..." : "Detectar Lançamentos"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Fatura Líquida"
          value={formatBRL(kpis.netAmount)}
          icon={<Receipt className="w-5 h-5" />}
          accent="primary"
        />
        <KPICard
          label="Despesas Brutas"
          value={formatBRL(kpis.grossAmount)}
          icon={<ArrowDownRight className="w-5 h-5" />}
          accent="destructive"
        />
        <KPICard
          label="Reembolsos"
          value={formatBRL(kpis.reimbursementAmount)}
          icon={<ArrowUpRight className="w-5 h-5" />}
          accent="success"
        />
        <KPICard
          label="Lançamentos"
          value={String(kpis.transactionCount)}
          icon={<CreditCard className="w-5 h-5" />}
          accent="primary"
          subtitle={`${kpis.cycleCount} faturas`}
        />
      </div>

      {/* Cycles + Categories */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cycles */}
        <div className="liquid-glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground/80 mb-4">Faturas por Ciclo</h3>
          {cycles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma fatura detectada. Clique em "Detectar Lançamentos".
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {cycles.map((c: any) => (
                <div key={c.id} className="liquid-glass-compact rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{c.card_label || "Cartão"}</span>
                    <Badge variant={c.status === "validated" ? "default" : "secondary"} className="text-[10px]">
                      {c.status === "validated" ? "Validado" : c.status === "needs_review" ? "Revisão" : c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Vencimento: {new Date(c.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    <span>{c.transaction_count} lançamentos</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Líquido</span>
                    <span className="text-sm font-semibold text-foreground">{formatBRL(Number(c.net_amount))}</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-red-500">Despesas: {formatBRL(Number(c.gross_amount))}</span>
                    {Number(c.reimbursement_amount) > 0 && (
                      <span className="text-emerald-500">Reembolsos: {formatBRL(Number(c.reimbursement_amount))}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <span>Aba: {c.source_tab}</span>
                    <span>•</span>
                    <span>Confiança: {Math.round(Number(c.detection_confidence) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="liquid-glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground/80 mb-4">Categorias</h3>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de categorias.</p>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories.slice(0, 8)}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {categories.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto w-full">
                {categories.slice(0, 10).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-foreground/80 truncate flex-1">{cat.name}</span>
                    <span className="font-medium text-foreground tabular-nums">{formatBRL(cat.total)}</span>
                    <span className="text-muted-foreground text-xs">({cat.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="liquid-glass rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-foreground/80">Lançamentos</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48 bg-white/50"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="h-8 text-xs rounded-lg border border-border/50 bg-white/50 px-2 text-foreground"
            >
              <option value="all">Todos</option>
              <option value="expense">Despesas</option>
              <option value="reimbursement">Reembolsos</option>
            </select>
          </div>
        </div>

        {filteredTxns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Vencimento</th>
                  <th className="text-left py-2 px-2 font-medium">Descrição</th>
                  <th className="text-left py-2 px-2 font-medium">Categoria</th>
                  <th className="text-right py-2 px-2 font-medium">Valor</th>
                  <th className="text-center py-2 px-2 font-medium">Tipo</th>
                  <th className="text-center py-2 px-2 font-medium">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.slice(0, 100).map((t: any) => (
                  <tr key={t.id} className="border-b border-border/10 hover:bg-white/30 transition-colors">
                    <td className="py-2 px-2 text-foreground/70">
                      {t.due_date ? new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                    </td>
                    <td className="py-2 px-2 text-foreground max-w-[250px] truncate">
                      {t.original_description || "-"}
                    </td>
                    <td className="py-2 px-2 text-foreground/70">{t.category_original || "-"}</td>
                    <td className={`py-2 px-2 text-right font-medium tabular-nums ${
                      t.transaction_type === "reimbursement" ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {t.transaction_type === "reimbursement" ? "+" : ""}{formatBRL(Math.abs(Number(t.amount)))}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge
                        variant={t.transaction_type === "reimbursement" ? "default" : "secondary"}
                        className="text-[9px] px-1.5"
                      >
                        {t.transaction_type === "reimbursement" ? "Reembolso" : "Despesa"}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center text-muted-foreground">
                      {Math.round(Number(t.detection_confidence) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTxns.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Mostrando 100 de {filteredTxns.length} lançamentos
              </p>
            )}
          </div>
        )}
      </div>

      {/* Review Queue */}
      {reviewItems.length > 0 && (
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground/80">
              Revisão Pendente ({reviewItems.length})
            </h3>
          </div>
          <div className="space-y-3">
            {reviewItems.slice(0, 20).map((item: any) => {
              const snapshot = item.raw_snapshot || {};
              return (
                <div key={item.id} className="liquid-glass-compact rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {snapshot.description || "Sem descrição"}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{snapshot.category || "-"}</span>
                      <span>•</span>
                      <span>{formatBRL(Math.abs(Number(snapshot.amount || 0)))}</span>
                      <span>•</span>
                      <span>Confiança: {Math.round(Number(item.confidence) * 100)}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Motivo: {item.reason_flag}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      onClick={() => reviewItem({ id: item.id, decision: "approved" })}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Incluir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      onClick={() => reviewItem({ id: item.id, decision: "rejected" })}
                    >
                      <XCircle className="w-3 h-3 text-red-400" />
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, accent, subtitle }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  subtitle?: string;
}) {
  const accentColor = accent === "destructive" ? "text-red-500" : accent === "success" ? "text-emerald-500" : "text-primary";
  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg bg-white/40 ${accentColor}`}>{icon}</div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg md:text-xl font-bold ${accentColor} tabular-nums`}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
