import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MonthlyData {
  month_key: string;
  receita_real: number;
  despesa_real: number;
  saldo_real: number;
  validation_status: string;
  calibration_notes: any[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client to get user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Service role client for data access
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const { sheet_id, horizon = "6m" } = await req.json();
    const horizonMonths = horizon === "3m" ? 3 : horizon === "12m" ? 12 : 6;

    // ========== STEP 1: Consolidate monthly dataset ==========
    let txQuery = db
      .from("transactions")
      .select("date, amount, type, category")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (sheet_id) {
      txQuery = txQuery.eq("source_sheet_id", sheet_id);
    }

    const { data: transactions, error: txError } = await txQuery;
    if (txError) throw txError;

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_data", message: "Nenhuma transação encontrada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by month
    const monthMap = new Map<string, { receitas: number; despesas: number; categories: Map<string, number> }>();

    for (const tx of transactions) {
      const monthKey = tx.date.substring(0, 7); // YYYY-MM
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { receitas: 0, despesas: 0, categories: new Map() });
      }
      const m = monthMap.get(monthKey)!;
      if (tx.amount > 0) {
        m.receitas += Number(tx.amount);
      } else {
        m.despesas += Math.abs(Number(tx.amount));
      }
      const catKey = `${tx.amount > 0 ? "R" : "D"}:${tx.category}`;
      m.categories.set(catKey, (m.categories.get(catKey) || 0) + Math.abs(Number(tx.amount)));
    }

    const sortedMonths = Array.from(monthMap.keys()).sort();
    
    if (sortedMonths.length < 2) {
      return new Response(
        JSON.stringify({ error: "insufficient_data", message: `Apenas ${sortedMonths.length} mês encontrado. Mínimo: 2 meses de transações + DRE.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lowDataMode = sortedMonths.length < 4;

    // Build real data array
    const realData: MonthlyData[] = sortedMonths.map((mk) => {
      const m = monthMap.get(mk)!;
      return {
        month_key: mk,
        receita_real: m.receitas,
        despesa_real: m.despesas,
        saldo_real: m.receitas - m.despesas,
        validation_status: "ok",
        calibration_notes: [],
      };
    });

    // ========== STEP 2: Validate with DRE ==========
    const { data: drePeriods } = await db
      .from("dre_periods")
      .select("id, period_key")
      .eq("user_id", userId)
      .in("period_key", sortedMonths);

    if (drePeriods && drePeriods.length > 0) {
      const periodIds = drePeriods.map((p: any) => p.id);
      const { data: dreLines } = await db
        .from("dre_lines")
        .select("period_id, line_label, value, is_subtotal, is_group, group_label")
        .eq("user_id", userId)
        .in("period_id", periodIds);

      if (dreLines) {
        const periodKeyMap = new Map(drePeriods.map((p: any) => [p.id, p.period_key]));

        // Group DRE lines by period
        const dreByPeriod = new Map<string, any[]>();
        for (const line of dreLines) {
          const pk = periodKeyMap.get(line.period_id) as string;
          if (!dreByPeriod.has(pk)) dreByPeriod.set(pk, []);
          dreByPeriod.get(pk)!.push(line);
        }

        const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        for (const rd of realData) {
          const lines = dreByPeriod.get(rd.month_key);
          if (!lines || lines.length === 0) continue;

          // Extract DRE KPIs using same logic as useDRE
          const findSubtotal = (kw: string) => lines.find((l: any) => l.is_subtotal && normalize(l.line_label).includes(kw));
          const findGroup = (kw: string) => lines.find((l: any) => l.is_group && normalize(l.line_label).includes(kw));
          const groupSum = (kw: string) => lines
            .filter((l: any) => l.group_label && normalize(l.group_label).includes(kw) && !l.is_group && !l.is_subtotal)
            .reduce((s: number, l: any) => s + Number(l.value), 0);

          const fatGroup = findGroup("faturamento");
          const faturamento = fatGroup && fatGroup.value !== 0 ? Number(fatGroup.value) : groupSum("faturamento");
          
          const recLiqLine = findSubtotal("receita liquida");
          const receitaLiquidaDre = recLiqLine ? Number(recLiqLine.value) : faturamento + groupSum("deducoe");

          const despTotalLine = findSubtotal("despesas totais") || findSubtotal("total despesas");
          const despesasTotaisDre = despTotalLine ? Math.abs(Number(despTotalLine.value)) : Math.abs(groupSum("despesa"));

          const resultadoLine = findSubtotal("resultado");
          const resultadoDre = resultadoLine ? Number(resultadoLine.value) : receitaLiquidaDre - despesasTotaisDre;

          // Check differences
          const diffReceita = rd.receita_real > 0 && receitaLiquidaDre > 0
            ? Math.abs(rd.receita_real - receitaLiquidaDre) / receitaLiquidaDre
            : 0;
          const diffDespesa = rd.despesa_real > 0 && despesasTotaisDre > 0
            ? Math.abs(rd.despesa_real - despesasTotaisDre) / despesasTotaisDre
            : 0;

          if (diffReceita > 0.15 || diffDespesa > 0.15) {
            rd.validation_status = "warning";
            rd.calibration_notes.push({
              type: "dre_divergence",
              diff_receita_pct: Math.round(diffReceita * 100),
              diff_despesa_pct: Math.round(diffDespesa * 100),
              dre_receita: receitaLiquidaDre,
              dre_despesa: despesasTotaisDre,
              dre_resultado: resultadoDre,
            });

            // Apply calibration: use DRE as reference
            if (receitaLiquidaDre > 0 && diffReceita > 0.15) {
              rd.receita_real = receitaLiquidaDre;
            }
            if (despesasTotaisDre > 0 && diffDespesa > 0.15) {
              rd.despesa_real = despesasTotaisDre;
            }
            rd.saldo_real = rd.receita_real - rd.despesa_real;
          }
        }
      }
    }

    // ========== STEP 3: Baseline deterministic forecast ==========
    const receitaSeries = realData.map((d) => d.receita_real);
    const despesaSeries = realData.map((d) => d.despesa_real);
    const saldoSeries = realData.map((d) => d.saldo_real);

    function weightedMovingAvg(series: number[]): number {
      const n = series.length;
      let weightSum = 0;
      let valSum = 0;
      for (let i = 0; i < n; i++) {
        const w = i + 1; // more recent = higher weight
        valSum += series[i] * w;
        weightSum += w;
      }
      return valSum / weightSum;
    }

    function linearSlope(series: number[]): number {
      const n = series.length;
      if (n < 2) return 0;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += series[i];
        sumXY += i * series[i];
        sumXX += i * i;
      }
      const denom = n * sumXX - sumX * sumX;
      if (denom === 0) return 0;
      return (n * sumXY - sumX * sumY) / denom;
    }

    function stdDev(series: number[]): number {
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      const variance = series.reduce((acc, v) => acc + (v - mean) ** 2, 0) / series.length;
      return Math.sqrt(variance);
    }

    const recAvg = weightedMovingAvg(receitaSeries);
    const despAvg = weightedMovingAvg(despesaSeries);
    const saldoAvg = weightedMovingAvg(saldoSeries);

    const recSlope = linearSlope(receitaSeries);
    const despSlope = linearSlope(despesaSeries);
    const saldoSlope = linearSlope(saldoSeries);

    const recStd = stdDev(receitaSeries);
    const despStd = stdDev(despesaSeries);
    const saldoStd = stdDev(saldoSeries);

    const n = realData.length;

    // Generate forecasts
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const [lastYear, lastMon] = lastMonth.split("-").map(Number);
    
    const forecastData: any[] = [];
    for (let i = 1; i <= horizonMonths; i++) {
      let fMonth = lastMon + i;
      let fYear = lastYear;
      while (fMonth > 12) { fMonth -= 12; fYear++; }
      const monthKey = `${fYear}-${String(fMonth).padStart(2, "0")}`;
      const idx = n + i - 1;

      // Seasonality: check same month from previous data
      const sameMonthData = realData.filter((d) => d.month_key.endsWith(`-${String(fMonth).padStart(2, "0")}`));
      let seasonalFactorRec = 1;
      let seasonalFactorDesp = 1;
      if (sameMonthData.length > 0) {
        const avgRec = receitaSeries.reduce((a, b) => a + b, 0) / n;
        const avgDesp = despesaSeries.reduce((a, b) => a + b, 0) / n;
        if (avgRec > 0) seasonalFactorRec = sameMonthData[sameMonthData.length - 1].receita_real / avgRec;
        if (avgDesp > 0) seasonalFactorDesp = sameMonthData[sameMonthData.length - 1].despesa_real / avgDesp;
        // Dampen seasonality (don't overfit)
        seasonalFactorRec = 1 + (seasonalFactorRec - 1) * 0.5;
        seasonalFactorDesp = 1 + (seasonalFactorDesp - 1) * 0.5;
      }

      // Dampen slope in low data mode to avoid overfitting with 2-3 points
      const slopeDampen = lowDataMode ? 0.3 : 1.0;
      const recBase = Math.max(0, (recAvg + recSlope * idx * slopeDampen) * seasonalFactorRec);
      const despBase = Math.max(0, (despAvg + despSlope * idx * slopeDampen) * seasonalFactorDesp);
      const saldoBase = recBase - despBase;

      forecastData.push({
        month_key: monthKey,
        is_forecast: true,
        receita_real: 0,
        despesa_real: 0,
        saldo_real: 0,
        receita_prev_base: Math.round(recBase),
        despesa_prev_base: Math.round(despBase),
        saldo_prev_base: Math.round(saldoBase),
        receita_prev_opt: Math.round(recBase + recStd),
        receita_prev_pess: Math.round(Math.max(0, recBase - recStd)),
        despesa_prev_opt: Math.round(Math.max(0, despBase - despStd)), // less expense = optimistic
        despesa_prev_pess: Math.round(despBase + despStd),
        saldo_prev_opt: Math.round(recBase + recStd - Math.max(0, despBase - despStd)),
        saldo_prev_pess: Math.round(Math.max(0, recBase - recStd) - (despBase + despStd)),
        validation_status: "ok",
        calibration_notes: [],
      });
    }

    // Confidence score
    let confidence = 85;
    if (n < 6) confidence -= (6 - n) * 8;
    const avgRec = receitaSeries.reduce((a, b) => a + b, 0) / n;
    const cv = avgRec > 0 ? recStd / avgRec : 0;
    if (cv > 0.3) confidence -= 15;
    else if (cv > 0.2) confidence -= 8;
    const warningCount = realData.filter((d) => d.validation_status === "warning").length;
    if (warningCount > 0) confidence -= warningCount * 5;
    // DRE validation bonus: if DRE matched all months, boost confidence
    const dreValidatedCount = drePeriods ? drePeriods.length : 0;
    if (dreValidatedCount > 0 && warningCount === 0) confidence += Math.min(10, dreValidatedCount * 5);
    confidence = Math.max(10, Math.min(100, confidence));

    // ========== STEP 4: Upsert to database ==========
    const allRows = [
      ...realData.map((d) => ({
        user_id: userId,
        sheet_id: sheet_id || null,
        month_key: d.month_key,
        receita_real: d.receita_real,
        despesa_real: d.despesa_real,
        saldo_real: d.saldo_real,
        receita_prev_base: null,
        despesa_prev_base: null,
        saldo_prev_base: null,
        receita_prev_opt: null,
        receita_prev_pess: null,
        despesa_prev_opt: null,
        despesa_prev_pess: null,
        saldo_prev_opt: null,
        saldo_prev_pess: null,
        confidence_score: confidence,
        validation_status: d.validation_status,
        calibration_notes: d.calibration_notes,
        is_forecast: false,
      })),
      ...forecastData.map((d) => ({
        user_id: userId,
        sheet_id: sheet_id || null,
        ...d,
        confidence_score: confidence,
      })),
    ];

    // Delete existing data for this user/sheet, then insert fresh
    let deleteQuery = db
      .from("forecast_monthly")
      .delete()
      .eq("user_id", userId);
    if (sheet_id) {
      deleteQuery = deleteQuery.eq("sheet_id", sheet_id);
    } else {
      deleteQuery = deleteQuery.is("sheet_id", null);
    }
    await deleteQuery;

    const { error: insertError } = await db
      .from("forecast_monthly")
      .insert(allRows);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        months_real: realData.length,
        months_forecast: forecastData.length,
        confidence,
        warnings: realData.filter((d) => d.validation_status === "warning").length,
        horizon,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("build-forecast error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
