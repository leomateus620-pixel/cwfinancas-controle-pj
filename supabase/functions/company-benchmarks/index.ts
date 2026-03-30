import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Static sector benchmarks (SEBRAE/IBGE references) ── */
const SECTOR_BENCHMARKS: Record<string, Record<string, { margem_liquida: number; crescimento_anual: number; despesas_sobre_faturamento: number; descricao: string }>> = {
  "Comércio": {
    MEI: { margem_liquida: 8, crescimento_anual: 6, despesas_sobre_faturamento: 85, descricao: "Comércio - MEI" },
    ME:  { margem_liquida: 10, crescimento_anual: 8, despesas_sobre_faturamento: 80, descricao: "Comércio - ME" },
    EPP: { margem_liquida: 12, crescimento_anual: 10, despesas_sobre_faturamento: 75, descricao: "Comércio - EPP" },
  },
  "Serviços": {
    MEI: { margem_liquida: 15, crescimento_anual: 8, despesas_sobre_faturamento: 75, descricao: "Serviços - MEI" },
    ME:  { margem_liquida: 18, crescimento_anual: 10, despesas_sobre_faturamento: 70, descricao: "Serviços - ME" },
    EPP: { margem_liquida: 20, crescimento_anual: 12, despesas_sobre_faturamento: 65, descricao: "Serviços - EPP" },
  },
  "Indústria": {
    MEI: { margem_liquida: 6, crescimento_anual: 5, despesas_sobre_faturamento: 88, descricao: "Indústria - MEI" },
    ME:  { margem_liquida: 8, crescimento_anual: 7, despesas_sobre_faturamento: 83, descricao: "Indústria - ME" },
    EPP: { margem_liquida: 10, crescimento_anual: 9, despesas_sobre_faturamento: 78, descricao: "Indústria - EPP" },
  },
  "Tecnologia": {
    MEI: { margem_liquida: 20, crescimento_anual: 15, despesas_sobre_faturamento: 70, descricao: "Tecnologia - MEI" },
    ME:  { margem_liquida: 25, crescimento_anual: 20, despesas_sobre_faturamento: 60, descricao: "Tecnologia - ME" },
    EPP: { margem_liquida: 28, crescimento_anual: 22, despesas_sobre_faturamento: 55, descricao: "Tecnologia - EPP" },
  },
  "Alimentação": {
    MEI: { margem_liquida: 10, crescimento_anual: 7, despesas_sobre_faturamento: 82, descricao: "Alimentação - MEI" },
    ME:  { margem_liquida: 12, crescimento_anual: 9, despesas_sobre_faturamento: 78, descricao: "Alimentação - ME" },
    EPP: { margem_liquida: 14, crescimento_anual: 11, despesas_sobre_faturamento: 74, descricao: "Alimentação - EPP" },
  },
  "Saúde": {
    MEI: { margem_liquida: 18, crescimento_anual: 10, despesas_sobre_faturamento: 72, descricao: "Saúde - MEI" },
    ME:  { margem_liquida: 22, crescimento_anual: 12, despesas_sobre_faturamento: 65, descricao: "Saúde - ME" },
    EPP: { margem_liquida: 25, crescimento_anual: 14, despesas_sobre_faturamento: 60, descricao: "Saúde - EPP" },
  },
  "Construção": {
    MEI: { margem_liquida: 8, crescimento_anual: 5, despesas_sobre_faturamento: 85, descricao: "Construção - MEI" },
    ME:  { margem_liquida: 10, crescimento_anual: 7, despesas_sobre_faturamento: 80, descricao: "Construção - ME" },
    EPP: { margem_liquida: 12, crescimento_anual: 9, despesas_sobre_faturamento: 76, descricao: "Construção - EPP" },
  },
  "Educação": {
    MEI: { margem_liquida: 15, crescimento_anual: 8, despesas_sobre_faturamento: 75, descricao: "Educação - MEI" },
    ME:  { margem_liquida: 18, crescimento_anual: 10, despesas_sobre_faturamento: 70, descricao: "Educação - ME" },
    EPP: { margem_liquida: 20, crescimento_anual: 12, despesas_sobre_faturamento: 65, descricao: "Educação - EPP" },
  },
  "Agronegócio": {
    MEI: { margem_liquida: 12, crescimento_anual: 8, despesas_sobre_faturamento: 80, descricao: "Agronegócio - MEI" },
    ME:  { margem_liquida: 14, crescimento_anual: 10, despesas_sobre_faturamento: 75, descricao: "Agronegócio - ME" },
    EPP: { margem_liquida: 16, crescimento_anual: 12, despesas_sobre_faturamento: 70, descricao: "Agronegócio - EPP" },
  },
  "Transporte e Logística": {
    MEI: { margem_liquida: 8, crescimento_anual: 6, despesas_sobre_faturamento: 85, descricao: "Transporte - MEI" },
    ME:  { margem_liquida: 10, crescimento_anual: 8, despesas_sobre_faturamento: 80, descricao: "Transporte - ME" },
    EPP: { margem_liquida: 12, crescimento_anual: 10, despesas_sobre_faturamento: 76, descricao: "Transporte - EPP" },
  },
};

const DEFAULT_BENCHMARK = { margem_liquida: 12, crescimento_anual: 8, despesas_sobre_faturamento: 78, descricao: "Média geral PME" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { setor, porte, kpis } = await req.json();

    // Get static benchmarks
    const sectorData = SECTOR_BENCHMARKS[setor];
    const benchmark = sectorData?.[porte] ?? sectorData?.["ME"] ?? DEFAULT_BENCHMARK;

    // Generate AI insights if we have KPIs
    let aiInsights: string | null = null;
    if (kpis && (kpis.margem !== undefined || kpis.receita !== undefined)) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const prompt = `Você é um analista financeiro brasileiro especialista em PMEs. Analise os dados desta empresa e compare com as médias do setor.

DADOS DA EMPRESA:
- Setor: ${setor || "Não informado"}
- Porte: ${porte || "Não informado"}
- Margem líquida atual: ${kpis.margem?.toFixed(1) ?? "N/D"}%
- Receita mensal: R$ ${kpis.receita?.toLocaleString("pt-BR") ?? "N/D"}
- Despesa mensal: R$ ${kpis.despesa?.toLocaleString("pt-BR") ?? "N/D"}
- Crescimento receita: ${kpis.crescimentoReceita?.toFixed(1) ?? "N/D"}%
- % Despesas/Receita: ${kpis.despesaSobreReceita?.toFixed(1) ?? "N/D"}%

BENCHMARKS DO SETOR (${benchmark.descricao}):
- Margem líquida média: ${benchmark.margem_liquida}%
- Crescimento anual médio: ${benchmark.crescimento_anual}%
- Despesas sobre faturamento médio: ${benchmark.despesas_sobre_faturamento}%

Forneça 3-4 insights curtos e práticos (máximo 2 linhas cada) comparando a empresa com o setor. Use emojis para destaque. Formato: lista com bullet points.`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Responda apenas em português brasileiro. Seja direto e prático." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            aiInsights = aiData.choices?.[0]?.message?.content ?? null;
          }
        } catch (e) {
          console.error("AI insights error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ benchmark, aiInsights, setor: setor || "Geral", porte: porte || "ME" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("company-benchmarks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
