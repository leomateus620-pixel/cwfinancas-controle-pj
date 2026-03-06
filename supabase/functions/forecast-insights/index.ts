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

    // Fetch forecast data (always sheet_id=null since we aggregate all)
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

    const realMonths = forecastData.filter((d: any) => !d.is_forecast);
    const predictedMonths = forecastData.filter((d: any) => d.is_forecast);

    const receitaReal = realMonths.map((d: any) => Number(d.receita_real));
    const despesaReal = realMonths.map((d: any) => Number(d.despesa_real));
    const avgReceita = receitaReal.reduce((a: number, b: number) => a + b, 0) / receitaReal.length;
    const avgDespesa = despesaReal.reduce((a: number, b: number) => a + b, 0) / despesaReal.length;

    const recentReceita = receitaReal.slice(-3);
    const olderReceita = receitaReal.slice(0, 3);
    const receitaTrend = recentReceita.length > 0 && olderReceita.length > 0
      ? ((recentReceita.reduce((a: number, b: number) => a + b, 0) / recentReceita.length) /
         (olderReceita.reduce((a: number, b: number) => a + b, 0) / olderReceita.length) - 1) * 100
      : 0;

    const avgPrevReceita = predictedMonths.length > 0
      ? predictedMonths.reduce((s: number, d: any) => s + Number(d.receita_prev_base || 0), 0) / predictedMonths.length
      : 0;
    const avgPrevDespesa = predictedMonths.length > 0
      ? predictedMonths.reduce((s: number, d: any) => s + Number(d.despesa_prev_base || 0), 0) / predictedMonths.length
      : 0;

    const warnings = realMonths.filter((d: any) => d.validation_status === "warning").length;
    const confidence = forecastData[0]?.confidence_score || 0;

    const formatBRL = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;

    const prompt = `Você é um CFO virtual analisando projeções financeiras de uma empresa brasileira.
Dados históricos (${realMonths.length} meses): receita média ${formatBRL(avgReceita)}/mês, despesa média ${formatBRL(avgDespesa)}/mês.
Tendência de receita nos últimos 3 meses vs primeiros 3 meses: ${receitaTrend > 0 ? "+" : ""}${receitaTrend.toFixed(1)}%.
Previsão base (próximos ${predictedMonths.length} meses): receita média ${formatBRL(avgPrevReceita)}/mês, despesa média ${formatBRL(avgPrevDespesa)}/mês.
Margem projetada: ${avgPrevReceita > 0 ? ((avgPrevReceita - avgPrevDespesa) / avgPrevReceita * 100).toFixed(1) : 0}%.
Score de confiança: ${confidence}/100.
${warnings > 0 ? `ALERTA: ${warnings} meses com divergência entre transações e DRE.` : ""}

Responda em JSON com exatamente esta estrutura:
{
  "summary": "Resumo executivo de 2-3 frases estilo CFO, direto e em português BR",
  "insights": [{"title": "...", "evidence": "dado numérico real", "impact": "alto/medio/baixo", "recommendation": "ação concreta"}],
  "risks": [{"title": "...", "evidence": "dado numérico", "severity": "alto/medio/baixo", "mitigation": "como mitigar"}],
  "opportunities": [{"title": "...", "evidence": "dado numérico", "potential": "estimativa", "next_steps": "próximo passo"}],
  "recommendations": [{"title": "...", "action": "ação específica", "expected_impact": "resultado esperado"}]
}

Regras:
- NÃO invente números. Use apenas os dados fornecidos.
- Cite evidências numéricas reais.
- Máximo 3 itens por lista.
- Tom direto, profissional, estilo "resumo do CFO".
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
        receita_trend: receitaTrend,
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
