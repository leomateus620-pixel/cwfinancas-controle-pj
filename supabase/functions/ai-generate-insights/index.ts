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
}

interface TransactionData {
  id: string;
  date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface MonthlySummary {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
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

    const { connection_id, date_from, date_to, filters } = body;

    // Default to last 12 months if no dates provided
    const endDate = date_to || new Date().toISOString().split("T")[0];
    const startDate = date_from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Build query
    let query = supabase
      .from("transactions")
      .select("id, date, description, category, type, amount")
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
      return new Response(
        JSON.stringify({
          summary: "Não há dados suficientes para gerar insights.",
          insights: [],
          risks: [],
          opportunities: [],
          metadata: {
            period: `${startDate} a ${endDate}`,
            transactions_analyzed: 0,
            generated_at: new Date().toISOString(),
          },
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
        };
      })
      .sort((a, b) => b.total - a.total);

    // Group by month
    const monthlyMap = new Map<string, { receitas: number; despesas: number }>();
    transactions.forEach(t => {
      const month = t.date.substring(0, 7); // YYYY-MM
      const existing = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
      if (t.type === "income") {
        existing.receitas += Number(t.amount);
      } else {
        existing.despesas += Number(t.amount);
      }
      monthlyMap.set(month, existing);
    });

    const monthlySummary: MonthlySummary[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.receitas - data.despesas,
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

    // Format currency for prompt
    const formatCurrency = (value: number) => 
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    // Top categories for expenses and income
    const topExpenseCategories = categorySummary
      .filter(c => c.type === "expense")
      .slice(0, 5)
      .map(c => `${c.category}: ${formatCurrency(c.total)} (${c.percentage.toFixed(1)}%)`)
      .join(", ");

    const topIncomeCategories = categorySummary
      .filter(c => c.type === "income")
      .slice(0, 5)
      .map(c => `${c.category}: ${formatCurrency(c.total)} (${c.percentage.toFixed(1)}%)`)
      .join(", ");

    // Build prompt with real data
    const prompt = `Você é um analista financeiro especializado em empresas brasileiras. Analise os seguintes dados financeiros e forneça insights acionáveis em português brasileiro.

DADOS DO PERÍODO: ${startDate} a ${endDate}
- Total de transações analisadas: ${transactions.length}
- Receita Total: ${formatCurrency(totalReceitas)}
- Despesas Totais: ${formatCurrency(totalDespesas)}
- Saldo (Lucro/Prejuízo): ${formatCurrency(saldo)}
- Margem de Lucro: ${margem.toFixed(1)}%

TENDÊNCIAS:
- Variação de Receita (últimos 3 meses vs anteriores): ${receitaTrend >= 0 ? "+" : ""}${receitaTrend.toFixed(1)}%
- Variação de Despesas (últimos 3 meses vs anteriores): ${despesaTrend >= 0 ? "+" : ""}${despesaTrend.toFixed(1)}%

PRINCIPAIS CATEGORIAS DE DESPESA:
${topExpenseCategories || "Não identificadas"}

PRINCIPAIS FONTES DE RECEITA:
${topIncomeCategories || "Não identificadas"}

EVOLUÇÃO MENSAL (últimos meses):
${monthlySummary.slice(-6).map(m => 
  `${m.month}: Receitas ${formatCurrency(m.receitas)}, Despesas ${formatCurrency(m.despesas)}, Saldo ${formatCurrency(m.saldo)}`
).join("\n")}

Com base EXCLUSIVAMENTE nesses dados, forneça:
1. Um resumo executivo (2-3 frases)
2. 3-5 insights específicos com evidências numéricas
3. Riscos identificados (se houver)
4. Oportunidades de melhoria
5. Perguntas importantes para investigar

IMPORTANTE:
- Use APENAS os números fornecidos como evidência
- Não invente dados ou percentuais
- Seja específico e acionável
- Foque em impacto para o negócio`;

    // Call Lovable AI
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
            content: "Você é um analista financeiro experiente. Responda em português brasileiro de forma clara e objetiva. Sempre cite os números reais como evidência dos insights." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("AI service unavailable");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response into structured format
    // For now, return raw content with metadata
    return new Response(
      JSON.stringify({
        summary: aiContent,
        raw_analysis: aiContent,
        kpis: {
          total_receitas: totalReceitas,
          total_despesas: totalDespesas,
          saldo: saldo,
          margem: margem,
          receita_trend: receitaTrend,
          despesa_trend: despesaTrend,
        },
        category_breakdown: categorySummary.slice(0, 10),
        monthly_trend: monthlySummary,
        metadata: {
          period: `${startDate} a ${endDate}`,
          transactions_analyzed: transactions.length,
          generated_at: new Date().toISOString(),
          model: "google/gemini-3-flash-preview",
        },
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
