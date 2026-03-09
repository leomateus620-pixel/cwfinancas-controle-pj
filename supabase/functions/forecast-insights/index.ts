import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const db = createClient(supabaseUrl, supabaseServiceKey);
    const { horizon = "6m" } = await req.json();

    // Fetch forecast data
    const { data: forecastData, error: fError } = await db
      .from("forecast_monthly")
      .select("*")
      .eq("user_id", userId)
      .is("sheet_id", null)
      .order("month_key", { ascending: true });

    if (fError) throw fError;
    if (!forecastData || forecastData.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_forecast", message: "Execute a previsão primeiro." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch top categories from transactions for richer context
    const { data: transactions } = await db
      .from("transactions")
      .select("amount, category, movement_type")
      .eq("user_id", userId)
      .neq("movement_type", "TRANSFER");

    const catTotals = new Map<string, number>();
    const catTotalsRec = new Map<string, number>();
    if (transactions) {
      for (const tx of transactions) {
        const amt = Math.abs(Number(tx.amount));
        if (tx.movement_type === "EXPENSE") {
          catTotals.set(tx.category, (catTotals.get(tx.category) || 0) + amt);
        } else if (tx.movement_type === "INCOME") {
          catTotalsRec.set(tx.category, (catTotalsRec.get(tx.category) || 0) + amt);
        }
      }
    }

    const topDespesas = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const totalDesp = topDespesas.reduce((s, [, v]) => s + v, 0);

    const topReceitas = Array.from(catTotalsRec.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const totalRec = topReceitas.reduce((s, [, v]) => s + v, 0);

    const realMonths = forecastData.filter((d: any) => !d.is_forecast);
    const predictedMonths = forecastData.filter((d: any) => d.is_forecast);

    const formatBRL = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`;

    // Build monthly breakdown tables
    const realTable = realMonths.map((d: any) => 
      `${d.month_key}: Receita ${formatBRL(d.receita_real)}, Despesa ${formatBRL(d.despesa_real)}, Saldo ${formatBRL(d.saldo_real)}`
    ).join("\n");

    const forecastTable = predictedMonths.map((d: any) => 
      `${d.month_key}: Receita ${formatBRL(d.receita_prev_base)}, Despesa ${formatBRL(d.despesa_prev_base)}, Saldo ${formatBRL(d.saldo_prev_base)}`
    ).join("\n");

    // Accumulated projected balance
    let accBalance = realMonths.length > 0 ? Number(realMonths[realMonths.length - 1].saldo_real) : 0;
    const accProjection = predictedMonths.map((d: any) => {
      accBalance += Number(d.saldo_prev_base || 0);
      return `${d.month_key}: Saldo acumulado ${formatBRL(accBalance)}`;
    }).join("\n");

    // Months with negative projected margin
    const negativeMonths = predictedMonths.filter((d: any) => (d.saldo_prev_base || 0) < 0);

    const topDespStr = topDespesas.map(([cat, val]) => 
      `- ${cat}: ${formatBRL(val)} (${totalDesp > 0 ? ((val / totalDesp) * 100).toFixed(0) : 0}%)`
    ).join("\n");

    const topRecStr = topReceitas.map(([cat, val]) => 
      `- ${cat}: ${formatBRL(val)} (${totalRec > 0 ? ((val / totalRec) * 100).toFixed(0) : 0}%)`
    ).join("\n");

    const warnings = realMonths.filter((d: any) => d.validation_status === "warning").length;
    const confidence = forecastData[0]?.confidence_score || 0;

    const prompt = `Você é um CFO virtual analisando projeções financeiras de uma empresa brasileira.

## DADOS HISTÓRICOS (${realMonths.length} meses)
${realTable}

## TOP 5 CATEGORIAS DE RECEITA
${topRecStr || "Sem dados de categorias"}

## TOP 5 CATEGORIAS DE DESPESA
${topDespStr || "Sem dados de categorias"}

## PROJEÇÃO BASE (próximos ${predictedMonths.length} meses)
${forecastTable}

## SALDO ACUMULADO PROJETADO
${accProjection}

${negativeMonths.length > 0 ? `⚠️ MESES COM MARGEM NEGATIVA PROJETADA: ${negativeMonths.map((d: any) => d.month_key).join(", ")}` : "✅ Todos os meses projetados com margem positiva."}

Score de confiança: ${confidence}/100.
${warnings > 0 ? `ALERTA: ${warnings} meses com divergência entre transações e DRE.` : ""}

Responda em JSON com exatamente esta estrutura:
{
  "summary": "Resumo executivo de 2-3 frases estilo CFO, direto e em português BR, citando números reais",
  "insights": [{"title": "...", "evidence": "dado numérico real dos dados acima", "impact": "alto/medio/baixo", "recommendation": "ação concreta baseada nas categorias"}],
  "risks": [{"title": "...", "evidence": "dado numérico dos dados acima", "severity": "alto/medio/baixo", "mitigation": "como mitigar com ação específica"}],
  "opportunities": [{"title": "...", "evidence": "dado numérico dos dados acima", "potential": "estimativa baseada nos dados", "next_steps": "próximo passo concreto"}],
  "recommendations": [{"title": "...", "action": "ação específica referenciando categorias reais", "expected_impact": "resultado esperado com número"}]
}

Regras:
- NÃO invente números. Use APENAS os dados fornecidos acima.
- Cite categorias reais de receita e despesa nas recomendações.
- Se houver meses com margem negativa, destaque como risco prioritário.
- Máximo 3 itens por lista.
- Tom direto, profissional, estilo "resumo do CFO para o CEO".
- Responda APENAS o JSON, sem markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      throw new Error("Falha na geração de insights via IA");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        summary: "Análise gerada com dados limitados. Revise os números manualmente.",
        insights: [],
        risks: [],
        opportunities: [],
        recommendations: [],
      };
    }

    // Delete previous insights for this user (sheet_id=null)
    await db.from("forecast_insights").delete().eq("user_id", userId).is("sheet_id", null).eq("horizon", horizon);

    const avgReceita = realMonths.reduce((s: number, d: any) => s + Number(d.receita_real), 0) / realMonths.length;
    const avgDespesa = realMonths.reduce((s: number, d: any) => s + Number(d.despesa_real), 0) / realMonths.length;

    const { error: insError } = await db.from("forecast_insights").insert({
      user_id: userId,
      sheet_id: null,
      horizon,
      summary: parsed.summary || null,
      insights: parsed.insights || [],
      risks: parsed.risks || [],
      opportunities: parsed.opportunities || [],
      recommendations: parsed.recommendations || [],
      metadata: {
        months_real: realMonths.length,
        months_forecast: predictedMonths.length,
        confidence,
        avg_receita: avgReceita,
        avg_despesa: avgDespesa,
        top_categorias_despesa: topDespesas.map(([cat, val]) => ({ categoria: cat, total: val })),
        top_categorias_receita: topReceitas.map(([cat, val]) => ({ categoria: cat, total: val })),
      },
    });
    if (insError) throw insError;

    return new Response(
      JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("forecast-insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
