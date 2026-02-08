import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface InsightsRequest {
  connection_id?: string;
  date_from?: string;
  date_to?: string;
  filters?: {
    categories?: string[];
    types?: ("income" | "expense")[];
  };
  force_refresh?: boolean;
}

interface TransactionData {
  id: string;
  date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  client_vendor: string | null;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
  type: string;
  avg_per_transaction: number;
}

interface MonthlySummary {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
  transaction_count: number;
}

interface Outlier {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  deviation: number;
}

interface Recurrence {
  description_pattern: string;
  avg_amount: number;
  frequency: number;
  months_present: number;
}

interface Concentration {
  name: string;
  total: number;
  percentage: number;
  type: "client" | "vendor";
}

// Format currency for display
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Calculate outliers (transactions > 2x category average)
function findOutliers(transactions: TransactionData[], categoryStats: Map<string, { total: number; count: number }>): Outlier[] {
  const outliers: Outlier[] = [];
  
  for (const tx of transactions) {
    const stats = categoryStats.get(`${tx.category}:${tx.type}`);
    if (!stats || stats.count < 3) continue;
    
    const avg = stats.total / stats.count;
    if (tx.amount > avg * 2) {
      outliers.push({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
        deviation: tx.amount / avg,
      });
    }
  }
  
  return outliers.sort((a, b) => b.deviation - a.deviation).slice(0, 5);
}

// Find recurring patterns
function findRecurrences(transactions: TransactionData[]): Recurrence[] {
  const patterns = new Map<string, { amounts: number[]; months: Set<string> }>();
  
  for (const tx of transactions) {
    // Normalize description for pattern matching
    const pattern = tx.description
      .toLowerCase()
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 30);
    
    if (pattern.length < 5) continue;
    
    const month = tx.date.substring(0, 7);
    const existing = patterns.get(pattern) || { amounts: [], months: new Set() };
    existing.amounts.push(tx.amount);
    existing.months.add(month);
    patterns.set(pattern, existing);
  }
  
  const recurrences: Recurrence[] = [];
  for (const [pattern, data] of patterns) {
    if (data.amounts.length >= 3 && data.months.size >= 2) {
      const avg = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
      recurrences.push({
        description_pattern: pattern,
        avg_amount: avg,
        frequency: data.amounts.length,
        months_present: data.months.size,
      });
    }
  }
  
  return recurrences.sort((a, b) => b.frequency - a.frequency).slice(0, 5);
}

// Find concentration (dependency on single client/vendor)
function findConcentration(transactions: TransactionData[]): Concentration[] {
  const totals = {
    income: new Map<string, number>(),
    expense: new Map<string, number>(),
  };
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  for (const tx of transactions) {
    const name = tx.client_vendor || tx.description.substring(0, 30);
    if (tx.type === "income") {
      totalIncome += tx.amount;
      totals.income.set(name, (totals.income.get(name) || 0) + tx.amount);
    } else {
      totalExpense += tx.amount;
      totals.expense.set(name, (totals.expense.get(name) || 0) + tx.amount);
    }
  }
  
  const concentrations: Concentration[] = [];
  
  // Top income sources
  for (const [name, total] of totals.income) {
    const pct = totalIncome > 0 ? (total / totalIncome) * 100 : 0;
    if (pct >= 20) {
      concentrations.push({ name, total, percentage: pct, type: "client" });
    }
  }
  
  // Top expense destinations
  for (const [name, total] of totals.expense) {
    const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
    if (pct >= 20) {
      concentrations.push({ name, total, percentage: pct, type: "vendor" });
    }
  }
  
  return concentrations.sort((a, b) => b.percentage - a.percentage).slice(0, 5);
}

// Build structured prompt for AI
function buildPrompt(
  kpis: { totalReceitas: number; totalDespesas: number; saldo: number; margem: number; receitaTrend: number; despesaTrend: number },
  monthlySummary: MonthlySummary[],
  categorySummary: CategorySummary[],
  outliers: Outlier[],
  recurrences: Recurrence[],
  concentrations: Concentration[],
  dataQuality: { coverage_pct: number; needs_review_count: number },
  period: string,
): string {
  const topExpenseCategories = categorySummary
    .filter(c => c.type === "expense")
    .slice(0, 5)
    .map(c => `${c.category}: ${formatCurrency(c.total)} (${c.percentage.toFixed(1)}%, ${c.count} tx)`)
    .join(", ");

  const topIncomeCategories = categorySummary
    .filter(c => c.type === "income")
    .slice(0, 5)
    .map(c => `${c.category}: ${formatCurrency(c.total)} (${c.percentage.toFixed(1)}%, ${c.count} tx)`)
    .join(", ");

  const outlierText = outliers.length > 0
    ? outliers.map(o => `${o.description}: ${formatCurrency(o.amount)} em ${o.category} (${o.deviation.toFixed(1)}x a média)`).join("; ")
    : "Nenhum outlier significativo";

  const recurrenceText = recurrences.length > 0
    ? recurrences.map(r => `"${r.description_pattern}": ${formatCurrency(r.avg_amount)} médio, ${r.frequency}x em ${r.months_present} meses`).join("; ")
    : "Nenhuma recorrência identificada";

  const concentrationText = concentrations.length > 0
    ? concentrations.map(c => `${c.name} (${c.type === "client" ? "cliente" : "fornecedor"}): ${c.percentage.toFixed(1)}% do ${c.type === "client" ? "faturamento" : "gasto"}`).join("; ")
    : "Distribuição equilibrada";

  const gapMonths = monthlySummary.filter(m => m.saldo < 0).map(m => m.month);
  const gapText = gapMonths.length > 0 ? `Meses com saldo negativo: ${gapMonths.join(", ")}` : "Nenhum mês com saldo negativo";

  return `Você é um analista financeiro sênior especializado em empresas brasileiras.

DADOS DO PERÍODO: ${period}

=== KPIs PRINCIPAIS ===
- Receita Total: ${formatCurrency(kpis.totalReceitas)}
- Despesas Totais: ${formatCurrency(kpis.totalDespesas)}
- Resultado (Lucro/Prejuízo): ${formatCurrency(kpis.saldo)}
- Margem: ${kpis.margem.toFixed(1)}%
- Tendência Receita: ${kpis.receitaTrend >= 0 ? "+" : ""}${kpis.receitaTrend.toFixed(1)}%
- Tendência Despesa: ${kpis.despesaTrend >= 0 ? "+" : ""}${kpis.despesaTrend.toFixed(1)}%

=== CATEGORIAS DE DESPESA (Top 5) ===
${topExpenseCategories || "Não identificadas"}

=== FONTES DE RECEITA (Top 5) ===
${topIncomeCategories || "Não identificadas"}

=== EVOLUÇÃO MENSAL ===
${monthlySummary.slice(-6).map(m => 
  `${m.month}: Receitas ${formatCurrency(m.receitas)}, Despesas ${formatCurrency(m.despesas)}, Saldo ${formatCurrency(m.saldo)}`
).join("\n")}

=== OUTLIERS (gastos > 2x média da categoria) ===
${outlierText}

=== RECORRÊNCIAS IDENTIFICADAS ===
${recurrenceText}

=== CONCENTRAÇÃO (dependência) ===
${concentrationText}

=== GAPS DE CAIXA ===
${gapText}

=== QUALIDADE DOS DADOS ===
- Cobertura: ${dataQuality.coverage_pct.toFixed(1)}%
- Itens para revisão: ${dataQuality.needs_review_count}

TAREFA: Gere insights estruturados seguindo EXATAMENTE o formato JSON abaixo.

REGRAS ABSOLUTAS:
1. Use APENAS os números fornecidos acima
2. NUNCA invente valores, percentuais ou tendências
3. Cite sempre a evidência numérica exata
4. Se cobertura < 95%, declare no summary e reduza assertividade
5. Cada insight deve ter evidência verificável nos dados

FORMATO DE RESPOSTA (JSON):
{
  "summary": "Resumo executivo de 2-3 frases baseado nos KPIs",
  "highlights": [
    {
      "title": "Título do destaque",
      "evidence": "Evidência numérica exata dos dados",
      "impact": "Impacto no negócio",
      "recommendation": "Ação recomendada"
    }
  ],
  "risks": [
    {
      "title": "Título do risco",
      "evidence": "Evidência numérica",
      "severity": "low|medium|high",
      "mitigation": "Como mitigar"
    }
  ],
  "opportunities": [
    {
      "title": "Título da oportunidade",
      "evidence": "Evidência numérica",
      "potential": "Potencial estimado",
      "next_steps": "Próximos passos"
    }
  ],
  "anomalies": [
    {
      "title": "Título da anomalia",
      "evidence": "Evidência numérica",
      "why_unusual": "Por que é incomum",
      "check": "O que verificar"
    }
  ],
  "questions": [
    "Pergunta investigativa 1",
    "Pergunta investigativa 2"
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    
    let body: InsightsRequest = {};
    try {
      body = await req.json();
    } catch {
      // Allow empty body
    }

    const { connection_id, date_from, date_to, filters, force_refresh } = body;

    // Default to last 12 months
    const endDate = date_to || new Date().toISOString().split("T")[0];
    const startDate = date_from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const period = `${startDate} a ${endDate}`;

    // Check cache first (unless force_refresh)
    if (!force_refresh) {
      const { data: cachedInsight } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("user_id", userId)
        .gte("date_from", startDate)
        .lte("date_to", endDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedInsight) {
        const cacheAge = Date.now() - new Date(cachedInsight.created_at).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (cacheAge < twentyFourHours) {
          return new Response(
            JSON.stringify({
              id: cachedInsight.id,
              kpis: cachedInsight.kpis,
              insights: cachedInsight.insights,
              created_at: cachedInsight.created_at,
              from_cache: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Build query
    let query = supabase
      .from("transactions")
      .select("id, date, description, category, type, amount, client_vendor")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (connection_id) {
      query = query.eq("source_sheet_id", connection_id);
    }

    if (filters?.categories?.length) {
      query = query.in("category", filters.categories);
    }

    if (filters?.types?.length) {
      query = query.in("type", filters.types);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error("Error fetching transactions:", txError);
      throw new Error("Failed to fetch transactions");
    }

    if (!transactions || transactions.length === 0) {
      const emptyResponse = {
        summary: "Não há dados suficientes para gerar insights.",
        highlights: [],
        risks: [],
        opportunities: [],
        anomalies: [],
        questions: [],
        data_quality: {
          coverage_pct: 0,
          needs_review_count: 0,
          notes: "Sem transações no período selecionado",
        },
        metadata: {
          period,
          transactions_analyzed: 0,
          generated_at: new Date().toISOString(),
          model: "none",
        },
      };

      return new Response(
        JSON.stringify({
          id: null,
          kpis: { total_receitas: 0, total_despesas: 0, saldo: 0, margem: 0, receita_trend: 0, despesa_trend: 0 },
          insights: emptyResponse,
          created_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate KPIs
    const totalReceitas = transactions
      .filter(t => t.type === "income")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const totalDespesas = transactions
      .filter(t => t.type === "expense")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const saldo = totalReceitas - totalDespesas;
    const margem = totalReceitas > 0 ? (saldo / totalReceitas) * 100 : 0;

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number; type: string }>();
    transactions.forEach(t => {
      const key = `${t.category}:${t.type}`;
      const existing = categoryMap.get(key) || { total: 0, count: 0, type: t.type };
      existing.total += Number(t.amount);
      existing.count++;
      categoryMap.set(key, existing);
    });

    const categorySummary: CategorySummary[] = Array.from(categoryMap.entries())
      .map(([key, value]) => {
        const [category] = key.split(":");
        const total = value.type === "income" ? totalReceitas : totalDespesas;
        return {
          category,
          total: value.total,
          count: value.count,
          percentage: total > 0 ? (value.total / total) * 100 : 0,
          type: value.type,
          avg_per_transaction: value.count > 0 ? value.total / value.count : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Group by month
    const monthlyMap = new Map<string, { receitas: number; despesas: number; count: number }>();
    transactions.forEach(t => {
      const month = t.date.substring(0, 7);
      const existing = monthlyMap.get(month) || { receitas: 0, despesas: 0, count: 0 };
      if (t.type === "income") {
        existing.receitas += Number(t.amount);
      } else {
        existing.despesas += Number(t.amount);
      }
      existing.count++;
      monthlyMap.set(month, existing);
    });

    const monthlySummary: MonthlySummary[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.receitas - data.despesas,
        transaction_count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate trends
    const months = monthlySummary.length;
    let receitaTrend = 0;
    let despesaTrend = 0;

    if (months >= 2) {
      const recent = monthlySummary.slice(-3);
      const older = monthlySummary.slice(0, Math.min(3, months - 3));

      if (older.length > 0) {
        const avgRecentReceita = recent.reduce((acc, m) => acc + m.receitas, 0) / recent.length;
        const avgOlderReceita = older.reduce((acc, m) => acc + m.receitas, 0) / older.length;
        receitaTrend = avgOlderReceita > 0 ? ((avgRecentReceita - avgOlderReceita) / avgOlderReceita) * 100 : 0;

        const avgRecentDespesa = recent.reduce((acc, m) => acc + m.despesas, 0) / recent.length;
        const avgOlderDespesa = older.reduce((acc, m) => acc + m.despesas, 0) / older.length;
        despesaTrend = avgOlderDespesa > 0 ? ((avgRecentDespesa - avgOlderDespesa) / avgOlderDespesa) * 100 : 0;
      }
    }

    // Find outliers, recurrences, concentrations
    const outliers = findOutliers(transactions as TransactionData[], categoryMap);
    const recurrences = findRecurrences(transactions as TransactionData[]);
    const concentrations = findConcentration(transactions as TransactionData[]);

    // Get data quality metrics
    const { count: flagCount } = await supabase
      .from("transaction_flags")
      .select("*", { count: "exact", head: true })
      .eq("needs_review", true);

    const dataQuality = {
      coverage_pct: transactions.length > 0 
        ? ((transactions.length - (flagCount || 0)) / transactions.length) * 100 
        : 100,
      needs_review_count: flagCount || 0,
    };

    const kpis = {
      totalReceitas,
      totalDespesas,
      saldo,
      margem,
      receitaTrend,
      despesaTrend,
    };

    // Build prompt and call AI
    const prompt = buildPrompt(
      kpis,
      monthlySummary,
      categorySummary,
      outliers,
      recurrences,
      concentrations,
      dataQuality,
      period,
    );

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: "Você é um analista financeiro experiente. Responda APENAS com JSON válido, sem markdown ou texto adicional. Siga exatamente o schema fornecido." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("AI service unavailable");
    }

    const aiData = await aiResponse.json();
    let aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown if present
    aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsedInsights;
    try {
      parsedInsights = JSON.parse(aiContent);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      parsedInsights = {
        summary: "Análise parcial disponível. Verifique os KPIs abaixo.",
        highlights: [],
        risks: [],
        opportunities: [],
        anomalies: [],
        questions: [],
      };
    }

    // Build final structured response
    const structuredInsights = {
      summary: parsedInsights.summary || "Sem resumo disponível",
      highlights: parsedInsights.highlights || [],
      risks: parsedInsights.risks || [],
      opportunities: parsedInsights.opportunities || [],
      anomalies: parsedInsights.anomalies || [],
      questions: parsedInsights.questions || [],
      data_quality: {
        coverage_pct: dataQuality.coverage_pct,
        needs_review_count: dataQuality.needs_review_count,
        notes: dataQuality.needs_review_count > 0 
          ? `${dataQuality.needs_review_count} transações precisam de revisão` 
          : "Todos os dados validados",
      },
      metadata: {
        period,
        transactions_analyzed: transactions.length,
        generated_at: new Date().toISOString(),
        model: "google/gemini-3-flash-preview",
      },
    };

    const kpisResponse = {
      total_receitas: totalReceitas,
      total_despesas: totalDespesas,
      saldo,
      margem,
      receita_trend: receitaTrend,
      despesa_trend: despesaTrend,
    };

    // Save to cache
    const { data: savedInsight, error: saveError } = await supabase
      .from("ai_insights")
      .insert({
        user_id: userId,
        connected_sheet_id: connection_id || null,
        date_from: startDate,
        date_to: endDate,
        filters: filters || {},
        kpis: kpisResponse,
        insights: structuredInsights,
        data_quality: structuredInsights.data_quality,
        model_version: "google/gemini-3-flash-preview",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving insights:", saveError);
    }

    return new Response(
      JSON.stringify({
        id: savedInsight?.id || null,
        kpis: kpisResponse,
        insights: structuredInsights,
        created_at: new Date().toISOString(),
        from_cache: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in ai-generate-insights:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
