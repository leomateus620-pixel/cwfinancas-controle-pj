import React, { useState, useEffect } from "react";
import { BarChart3, RefreshCw, FileSpreadsheet, Monitor, Building2, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDRE, type DRELine } from "@/hooks/useDRE";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { formatCurrencyBR } from "@/lib/currency";

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatCurrencyBR(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function formatPeriodLabel(key: string, label?: string | null): string {
  if (label) return label;
  if (key === "TOTAL") return "TOTAL";
  if (key.startsWith("REVIEW_")) return `⚠️ ${key.replace("REVIEW_", "")}`;
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(match[2]) - 1]}/${match[1]}`;
  }
  return key;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(true);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

// ========== SUB-COMPONENTS ==========

function DREKpiCards({ kpis }: { kpis: { faturamento: number; receitaLiquida: number; despesasTotais: number; resultado: number; margemLiquida: number | null } }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[
        { label: "Faturamento", value: formatBRL(kpis.faturamento) },
        { label: "Receita Líquida", value: formatBRL(kpis.receitaLiquida) },
        { label: "Despesas Totais", value: formatBRL(kpis.despesasTotais) },
        { label: "Resultado do Mês", value: formatBRL(kpis.resultado), color: kpis.resultado >= 0 ? "text-emerald-600" : "text-destructive" },
        { label: "Margem Líquida", value: formatPercent(kpis.margemLiquida) },
      ].map(kpi => (
        <Card key={kpi.label} className="corporate-card">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-lg font-bold tabular-nums ${"color" in kpi ? kpi.color : "text-foreground"}`}>{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DRETableDefault({ lines }: { lines: DRELine[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="w-[60%]">Linha DRE</TableHead>
          <TableHead className="text-right">Valor (R$)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.length > 0 ? (
          lines.map((line) => {
            if (line.is_group) {
              return (
                <TableRow key={line.id} className="bg-muted/40">
                  <TableCell colSpan={2} className="py-2 font-bold text-foreground uppercase text-xs tracking-wider">
                    {line.line_label}
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={line.id} className={line.is_subtotal ? "bg-muted/20 border-t border-border" : ""}>
                <TableCell className={`${line.is_subtotal ? "font-semibold text-foreground" : "text-foreground/80 pl-8"}`}>
                  {line.line_label}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${line.is_subtotal ? "font-semibold" : ""} ${line.value < 0 ? "text-destructive" : ""}`}>
                  {formatBRL(line.value)}
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
              Nenhuma linha importada para este período.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function DRETableByNucleo({ lines, nucleos }: { lines: DRELine[]; nucleos: string[] }) {
  // Group lines by order_index to show them side by side
  const orderMap = new Map<number, { label: string; isGroup: boolean; isSubtotal: boolean; section: string | null; values: Map<string, number> }>();
  
  for (const line of lines) {
    if (!line.nucleo) continue; // skip consolidated in by_nucleo view
    if (!orderMap.has(line.order_index)) {
      orderMap.set(line.order_index, {
        label: line.line_label,
        isGroup: line.is_group,
        isSubtotal: line.is_subtotal,
        section: line.section,
        values: new Map(),
      });
    }
    orderMap.get(line.order_index)!.values.set(line.nucleo, line.value);
  }

  const sortedEntries = Array.from(orderMap.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="w-[40%]">Linha DRE</TableHead>
          {nucleos.map(n => (
            <TableHead key={n} className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Núcleo {n.charAt(0) + n.slice(1).toLowerCase()}</span>
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedEntries.length > 0 ? (
          sortedEntries.map(([order, entry]) => {
            if (entry.isGroup) {
              return (
                <TableRow key={order} className="bg-muted/40">
                  <TableCell colSpan={nucleos.length + 1} className="py-2 font-bold text-foreground uppercase text-xs tracking-wider">
                    {entry.label}
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={order} className={entry.isSubtotal ? "bg-muted/20 border-t border-border" : ""}>
                <TableCell className={`${entry.isSubtotal ? "font-semibold text-foreground" : "text-foreground/80 pl-8"}`}>
                  {entry.label}
                </TableCell>
                {nucleos.map(n => {
                  const val = entry.values.get(n) ?? 0;
                  return (
                    <TableCell key={n} className={`text-right tabular-nums ${entry.isSubtotal ? "font-semibold" : ""} ${val < 0 ? "text-destructive" : ""}`}>
                      {formatBRL(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={nucleos.length + 1} className="text-center text-muted-foreground py-8">
              Nenhuma linha importada para este período.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ========== MAIN PAGE ==========

export default function DREPage() {
  const isDesktop = useIsDesktop();
  const { connections } = useGoogleSheets();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [viewMode, setViewMode] = useState<"consolidated" | "by_nucleo">("consolidated");

  const activeConnectionId = selectedConnectionId || connections?.[0]?.id || "";

  const {
    periodOptions,
    isLoadingPeriods,
    useLines,
    syncDRE,
    calculateKPIs,
    getNucleos,
    hasData,
    activeTemplate,
  } = useDRE(activeConnectionId || undefined);

  useEffect(() => {
    if (!selectedPeriodKey && periodOptions.length > 0) {
      setSelectedPeriodKey(periodOptions[0].key);
    }
  }, [periodOptions, selectedPeriodKey]);

  const selectedPeriod = periodOptions.find(p => p.key === selectedPeriodKey);
  const { data: lines, isLoading: isLoadingLines } = useLines(selectedPeriod?.id);

  const kpis = lines ? calculateKPIs(lines, viewMode) : null;
  const nucleos = lines ? getNucleos(lines) : [];
  const isLcf = activeTemplate === "LCF_NUCLEO";
  const isSyncing = syncDRE.isPending;

  const handleSync = () => {
    if (activeConnectionId) {
      syncDRE.mutate(activeConnectionId);
    }
  };

  // Filter lines based on view mode
  const displayLines = lines
    ? viewMode === "consolidated"
      ? lines.filter(l => l.nucleo === null)
      : lines
    : [];

  if (!isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <Monitor className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">DRE disponível apenas no desktop</h2>
        <p className="text-muted-foreground max-w-sm">
          Para visualizar a Demonstração do Resultado do Exercício, acesse pelo computador.
        </p>
      </div>
    );
  }

  // Empty state
  if (!isLoadingPeriods && !hasData && !isSyncing) {
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
              <strong> "DRE"</strong> com as linhas do demonstrativo.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm text-muted-foreground max-w-md">
              <p className="font-medium text-foreground mb-2">Formatos suportados:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Padrão:</strong> Uma aba "DRE" com colunas de meses</li>
                <li><strong>LCF por Núcleo:</strong> Múltiplas abas (DRE Jan26, DRE Fev26…) com colunas por núcleo</li>
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

  const isLoading = isLoadingPeriods || isLoadingLines;

  return (
    <div className="space-y-6 animate-corporate-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">DRE</h1>
          {isLcf && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
              LCF por Núcleo
            </Badge>
          )}
          {selectedPeriod?.validationStatus === "warning" && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Divergência detectada
            </Badge>
          )}
          {selectedPeriod?.validationStatus === "NEEDS_REVIEW" && (
            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
              Revisão necessária
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
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
          {periodOptions.length > 0 && (
            <Select value={selectedPeriodKey} onValueChange={setSelectedPeriodKey}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(p => (
                  <SelectItem key={p.key} value={p.key}>
                    {formatPeriodLabel(p.key, p.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isLcf && nucleos.length >= 2 && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => { if (v) setViewMode(v as "consolidated" | "by_nucleo"); }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="consolidated" aria-label="Consolidado">
                <Layers className="h-4 w-4 mr-1.5" />
                Consolidado
              </ToggleGroupItem>
              <ToggleGroupItem value="by_nucleo" aria-label="Por Núcleo">
                <Building2 className="h-4 w-4 mr-1.5" />
                Por Núcleo
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button onClick={handleSync} disabled={isSyncing || !activeConnectionId} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Atualizar DRE
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : (
        <>
          {kpis && <DREKpiCards kpis={kpis} />}

          <Card className="corporate-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Demonstração do Resultado do Exercício
                {viewMode === "by_nucleo" && isLcf && " — Por Núcleo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === "by_nucleo" && isLcf && nucleos.length >= 2 ? (
                <DRETableByNucleo lines={displayLines} nucleos={nucleos} />
              ) : (
                <DRETableDefault lines={displayLines} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
