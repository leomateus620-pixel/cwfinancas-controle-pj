import React, { useState, useEffect, useMemo } from "react";
import { BarChart3, RefreshCw, FileSpreadsheet, Monitor, Building2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDRE, type DRELine } from "@/hooks/useDRE";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { DreSummaryCards } from "@/components/dre/DreSummaryCards";
import { DreStoryFlow } from "@/components/dre/DreStoryFlow";
import { DreDetailsAccordion } from "@/components/dre/DreDetailsAccordion";
import { formatPeriodLabel, extractYearFromPeriodKey } from "@/components/dre/DreLabels";

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

export default function DREPage() {
  const isDesktop = useIsDesktop();
  const { connections } = useGoogleSheets();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedScenario, setSelectedScenario] = useState<string>("realizado");
  const [viewMode, setViewMode] = useState<"consolidated" | "by_nucleo">("consolidated");
  const [selectedNucleo, setSelectedNucleo] = useState<string>("");

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
    availableYears,
    availableScenarios,
  } = useDRE(activeConnectionId || undefined);

  // Auto-select best year (2026 > 2025 > 2024)
  useEffect(() => {
    if (!selectedYear && availableYears.length > 0) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  // Filter periods by selected year
  const filteredPeriodOptions = useMemo(() => {
    if (!selectedYear) return periodOptions;
    return periodOptions.filter(p => {
      const year = extractYearFromPeriodKey(p.key);
      return year === parseInt(selectedYear) || (!year && p.key === "TOTAL");
    });
  }, [periodOptions, selectedYear]);

  // Auto-select period: prefer latest month, fallback to TOTAL
  useEffect(() => {
    if (filteredPeriodOptions.length > 0) {
      // If current selection is valid, keep it
      if (filteredPeriodOptions.some(p => p.key === selectedPeriodKey)) return;
      
      // Prefer latest monthly period (not TOTAL)
      const monthlyPeriods = filteredPeriodOptions.filter(p => !p.key.includes("TOTAL"));
      if (monthlyPeriods.length > 0) {
        // Pick the last month (highest period key)
        const latest = monthlyPeriods[monthlyPeriods.length - 1];
        setSelectedPeriodKey(latest.key);
      } else {
        // Fallback to TOTAL or first available
        const totalKey = `${selectedYear}-TOTAL`;
        const hasTotal = filteredPeriodOptions.some(p => p.key === totalKey);
        setSelectedPeriodKey(hasTotal ? totalKey : filteredPeriodOptions[0].key);
      }
    }
  }, [filteredPeriodOptions, selectedYear, selectedPeriodKey]);

  // Filter by scenario for SAH model
  const scenarioFilteredOptions = useMemo(() => {
    if (availableScenarios.length === 0) return filteredPeriodOptions;
    return filteredPeriodOptions.filter(p => {
      if (!p.scenario) return true;
      return p.scenario === selectedScenario;
    });
  }, [filteredPeriodOptions, selectedScenario, availableScenarios]);

  const selectedPeriod = scenarioFilteredOptions.find(p => p.key === selectedPeriodKey)
    || scenarioFilteredOptions[0];

  const { data: lines, isLoading: isLoadingLines } = useLines(selectedPeriod?.id);

  const nucleos = lines ? getNucleos(lines) : [];
  const isLcf = activeTemplate === "LCF_NUCLEO" || (periodOptions || []).some(p => p.templateType === "LCF_NUCLEO");

  // Auto-select first nucleo when switching to by_nucleo mode
  useEffect(() => {
    if (viewMode === "by_nucleo" && nucleos.length > 0 && !nucleos.includes(selectedNucleo)) {
      setSelectedNucleo(nucleos[0]);
    }
  }, [viewMode, nucleos, selectedNucleo]);

  // Filter lines for KPI calculation based on view mode and selected nucleo
  const kpiLines = useMemo(() => {
    if (!lines) return null;
    if (viewMode === "by_nucleo" && selectedNucleo) {
      return lines.filter(l => l.nucleo === selectedNucleo);
    }
    return lines;
  }, [lines, viewMode, selectedNucleo]);

  const kpis = kpiLines ? calculateKPIs(kpiLines, viewMode) : null;
  const isSyncing = syncDRE.isPending;

  const handleSync = () => {
    if (activeConnectionId) {
      syncDRE.mutate(activeConnectionId);
    }
  };

  const displayLines = lines
    ? viewMode === "consolidated"
      ? lines.filter(l => l.nucleo === null)
      : lines.filter(l => l.nucleo !== null)
    : [];

  if (!isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <Monitor className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">DRE disponível apenas no desktop</h2>
        <p className="text-muted-foreground max-w-sm">
          Para visualizar o resultado financeiro, acesse pelo computador.
        </p>
      </div>
    );
  }

  // Empty state
  if (!isLoadingPeriods && !hasData && !isSyncing) {
    return (
      <div className="space-y-6 animate-corporate-enter home-glass-bg min-h-[60vh] p-1">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Resultado Financeiro</h1>
        </div>
        <div className="liquid-glass p-12 text-center space-y-6 relative overflow-hidden">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-primary/3 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <div className="p-3 rounded-2xl bg-primary/5 w-fit mx-auto">
              <FileSpreadsheet className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum resultado importado</h3>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
              Conecte uma planilha com uma aba <strong className="text-foreground/80">"DRE"</strong> para ver o resumo financeiro da sua empresa de forma simples e visual.
            </p>
            {connections && connections.length > 0 && (
              <Button onClick={() => syncDRE.mutate(connections[0].id)} disabled={isSyncing} className="mt-2">
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Importar DRE
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isLoading = isLoadingPeriods || isLoadingLines;

  return (
    <div className="space-y-5 animate-corporate-enter home-glass-bg min-h-[60vh] p-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Resultado Financeiro</h1>
          {isLcf && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">
              LCF
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {connections && connections.length > 1 && (
            <Select value={activeConnectionId} onValueChange={setSelectedConnectionId}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Planilha" />
              </SelectTrigger>
              <SelectContent>
                {connections.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.spreadsheet_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableYears.length > 1 && (
            <Select value={selectedYear} onValueChange={(y) => { setSelectedYear(y); setSelectedPeriodKey(""); }}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {scenarioFilteredOptions.length > 0 && (
            <Select value={selectedPeriodKey} onValueChange={setSelectedPeriodKey}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {scenarioFilteredOptions.map(p => (
                  <SelectItem key={p.key + (p.scenario || "")} value={p.key}>
                    {formatPeriodLabel(p.key, p.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableScenarios.length > 1 && (
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue placeholder="Cenário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
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
                <Layers className="h-3.5 w-3.5 mr-1" />
                Consolidado
              </ToggleGroupItem>
              <ToggleGroupItem value="by_nucleo" aria-label="Por Núcleo">
                <Building2 className="h-3.5 w-3.5 mr-1" />
                Por Núcleo
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button onClick={handleSync} disabled={isSyncing || !activeConnectionId} size="sm" className="h-9">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : (
        <>
          {kpis && (
            <DreSummaryCards
              faturamento={kpis.faturamento}
              receitaLiquida={kpis.receitaLiquida}
              despesasTotais={kpis.despesasTotais}
              resultado={kpis.resultado}
              margemLiquida={kpis.margemLiquida}
              isConsistent={kpis.isConsistent}
              deducoes={'deducoes' in kpis ? (kpis as any).deducoes : undefined}
            />
          )}

          {kpis && (
            <DreStoryFlow
              faturamento={kpis.faturamento}
              resultado={kpis.resultado}
              totalSaiu={'totalSaiu' in kpis ? (kpis as any).totalSaiu : undefined}
            />
          )}

          <DreDetailsAccordion lines={displayLines} viewMode={viewMode} nucleos={nucleos} />
        </>
      )}
    </div>
  );
}
