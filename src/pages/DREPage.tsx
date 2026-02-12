import React, { useState } from "react";
import { BarChart3, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useDRE } from "@/hooks/useDRE";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";

type LineKey =
  | "REVENUE_GROSS" | "TAXES" | "REVENUE_NET" | "COGS" | "GROSS_PROFIT"
  | "OPEX_TOTAL" | "OPEX_ADMIN" | "OPEX_SALES" | "OPEX_PAYROLL" | "OPEX_FINANCE" | "OPEX_OTHER"
  | "EBITDA" | "OPERATING_INCOME" | "FIN_RESULT" | "PRE_TAX_INCOME" | "IR_CSLL" | "NET_INCOME";

interface DRELineConfig {
  key: LineKey;
  label: string;
  isSubtotal: boolean;
  indent: number;
  showPercentage: boolean;
  prefix?: string;
}

const DRE_LINES: DRELineConfig[] = [
  { key: "REVENUE_GROSS", label: "Receita Bruta", isSubtotal: false, indent: 0, showPercentage: false },
  { key: "TAXES", label: "Deduções/Impostos", isSubtotal: false, indent: 0, showPercentage: false, prefix: "(-)" },
  { key: "REVENUE_NET", label: "Receita Líquida", isSubtotal: true, indent: 0, showPercentage: true },
  { key: "COGS", label: "Custos / CMV", isSubtotal: false, indent: 0, showPercentage: true, prefix: "(-)" },
  { key: "GROSS_PROFIT", label: "Lucro Bruto", isSubtotal: true, indent: 0, showPercentage: true },
  { key: "OPEX_ADMIN", label: "Administrativas", isSubtotal: false, indent: 1, showPercentage: true },
  { key: "OPEX_SALES", label: "Comerciais/Marketing", isSubtotal: false, indent: 1, showPercentage: true },
  { key: "OPEX_PAYROLL", label: "Pessoal/Salários", isSubtotal: false, indent: 1, showPercentage: true },
  { key: "OPEX_FINANCE", label: "Financeiras", isSubtotal: false, indent: 1, showPercentage: true },
  { key: "OPEX_OTHER", label: "Outras Despesas", isSubtotal: false, indent: 1, showPercentage: true },
  { key: "OPEX_TOTAL", label: "Total Despesas Operacionais", isSubtotal: true, indent: 0, showPercentage: true },
  { key: "EBITDA", label: "EBITDA", isSubtotal: true, indent: 0, showPercentage: true },
  { key: "FIN_RESULT", label: "Resultado Financeiro", isSubtotal: false, indent: 0, showPercentage: true },
  { key: "IR_CSLL", label: "IR / CSLL", isSubtotal: false, indent: 0, showPercentage: true, prefix: "(-)" },
  { key: "NET_INCOME", label: "Resultado Líquido", isSubtotal: true, indent: 0, showPercentage: true },
];

function formatBRL(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatPeriodLabel(key: string): string {
  if (key === "summary") return "Resumo";
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(match[2]) - 1]}/${match[1]}`;
  }
  return key;
}

export default function DREPage() {
  const { connections } = useGoogleSheets();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  const activeConnectionId = selectedConnectionId || connections?.[0]?.id || "";

  const {
    dreValues,
    isLoadingValues,
    periods,
    isLoadingPeriods,
    syncDRE,
    getValue,
    getItem,
    margins,
    divergences,
    hasData,
  } = useDRE(activeConnectionId || undefined);

  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const activePeriod = selectedPeriod || periods?.[0] || "";

  // Filter values for selected period
  const periodValues = dreValues?.filter(v => v.period_key === activePeriod) || [];
  const getVal = (key: LineKey): number | null => {
    const item = periodValues.find(v => v.line_key === key);
    return item ? item.value : null;
  };
  const getItemForPeriod = (key: LineKey) => periodValues.find(v => v.line_key === key) || null;

  const revenueNet = getVal("REVENUE_NET");
  const calcPercent = (key: LineKey): number | null => {
    const val = getVal(key);
    if (val === null || !revenueNet || revenueNet === 0) return null;
    return (val / revenueNet) * 100;
  };

  const periodMargins = (() => {
    if (!revenueNet || revenueNet === 0) return { grossMargin: null, ebitdaMargin: null, netMargin: null };
    const gp = getVal("GROSS_PROFIT");
    const ebitda = getVal("EBITDA");
    const ni = getVal("NET_INCOME");
    return {
      grossMargin: gp !== null ? (gp / revenueNet) * 100 : null,
      ebitdaMargin: ebitda !== null ? (ebitda / revenueNet) * 100 : null,
      netMargin: ni !== null ? (ni / revenueNet) * 100 : null,
    };
  })();

  const lastSync = dreValues?.[0]?.updated_at;
  const isSyncing = syncDRE.isPending;

  const handleSync = () => {
    if (activeConnectionId) {
      syncDRE.mutate(activeConnectionId);
    }
  };

  // KPI Cards
  const kpis = [
    { label: "Receita Líquida", value: formatBRL(getVal("REVENUE_NET")), color: "text-primary" },
    { label: "Lucro Bruto", value: formatBRL(getVal("GROSS_PROFIT")), color: "text-emerald-600" },
    { label: "EBITDA", value: formatBRL(getVal("EBITDA")), color: "text-blue-600" },
    { label: "Resultado Líquido", value: formatBRL(getVal("NET_INCOME")), color: getVal("NET_INCOME") !== null && getVal("NET_INCOME")! >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Margem Bruta", value: formatPercent(periodMargins.grossMargin), color: "text-muted-foreground" },
    { label: "Margem EBITDA", value: formatPercent(periodMargins.ebitdaMargin), color: "text-muted-foreground" },
    { label: "Margem Líquida", value: formatPercent(periodMargins.netMargin), color: "text-muted-foreground" },
  ];

  // Empty state
  if (!isLoadingValues && !hasData && !isSyncing) {
    return (
      <div className="space-y-6 animate-corporate-enter">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">DRE</h1>
        </div>
        <Card className="corporate-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold text-foreground">Nenhuma DRE importada</h3>
            <p className="text-muted-foreground max-w-md">
              Para visualizar sua DRE, conecte uma planilha no Google Sheets que contenha uma aba chamada
              <strong> "DRE"</strong> com as linhas do demonstrativo (Receita Bruta, Custos, Despesas, etc.).
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm text-muted-foreground max-w-md">
              <p className="font-medium text-foreground mb-2">Template sugerido para a aba DRE:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Coluna A: Nome da linha (ex: Receita Bruta)</li>
                <li>Colunas B, C, D...: Valores por mês (Jan, Fev, Mar...)</li>
                <li>Linhas: Receita, Deduções, Custos, Despesas, EBITDA, Resultado</li>
              </ul>
            </div>
            {connections && connections.length > 0 && (
              <Button onClick={() => syncDRE.mutate(connections[0].id)} disabled={isSyncing} className="mt-4">
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Importar DRE
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-corporate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">DRE</h1>
          {divergences.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {divergences.length} divergência(s)
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Valores recalculados por inconsistência com a planilha</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection selector */}
          {connections && connections.length > 1 && (
            <Select value={activeConnectionId} onValueChange={setSelectedConnectionId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Planilha" />
              </SelectTrigger>
              <SelectContent>
                {connections.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.spreadsheet_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Period selector */}
          {periods && periods.length > 0 && (
            <Select value={activePeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {periods.map(p => (
                  <SelectItem key={p} value={p}>{formatPeriodLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {lastSync && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Atualizado: {new Date(lastSync).toLocaleDateString("pt-BR")}
            </span>
          )}
          <Button onClick={handleSync} disabled={isSyncing || !activeConnectionId} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Atualizar DRE
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoadingValues ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array(7).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="corporate-card">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{kpi.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* DRE Table */}
          <Card className="corporate-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Demonstração do Resultado do Exercício</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[40%]">Linha DRE</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                    <TableHead className="text-right">% Receita Líq.</TableHead>
                    <TableHead className="text-center w-[60px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DRE_LINES.map((line) => {
                    const val = getVal(line.key);
                    const item = getItemForPeriod(line.key);
                    const pct = line.showPercentage ? calcPercent(line.key) : null;
                    const isDivergent = item?.is_calculated && item?.original_value !== null && Math.abs(item.value - item.original_value) > 1;
                    const isSubtotalRow = line.isSubtotal;

                    // Separator before OPEX items
                    const showOpexHeader = line.key === "OPEX_ADMIN";

                    return (
                      <React.Fragment key={line.key}>
                        {showOpexHeader && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={4} className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              (-) Despesas Operacionais
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow
                          className={isSubtotalRow ? "bg-muted/30 border-t-2 border-border" : ""}
                        >
                          <TableCell className={`${isSubtotalRow ? "font-bold text-foreground" : "text-foreground/80"}`}>
                            <span style={{ paddingLeft: `${line.indent * 20}px` }}>
                              {line.prefix && <span className="text-muted-foreground mr-1">{line.prefix}</span>}
                              {line.indent > 0 && "· "}
                              {line.label}
                            </span>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${isSubtotalRow ? "font-bold" : ""} ${val !== null && val < 0 ? "text-destructive" : ""}`}>
                            {formatBRL(val)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {line.key === "REVENUE_NET" ? "100%" : (pct !== null ? formatPercent(pct) : "—")}
                          </TableCell>
                          <TableCell className="text-center">
                            {item && (
                              isDivergent ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">
                                      Valor recalculado. Original na planilha: {formatBRL(item.original_value)}
                                      {item.source_cell && <><br />Origem: {item.source_cell}</>}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">
                                      {item.is_calculated ? "Calculado internamente" : `Origem: ${item.source_cell || "—"}`}
                                      {item.source_label && <><br />{item.source_label}</>}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
