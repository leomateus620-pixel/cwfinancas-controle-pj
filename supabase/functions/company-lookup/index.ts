import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    if (!companyName || typeof companyName !== "string" || companyName.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome da empresa inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const prompt = `Você é um assistente especializado em dados cadastrais de empresas brasileiras.
Com base no nome "${companyName.trim()}", retorne os dados mais prováveis da empresa em formato JSON.

Se o nome parecer ser de uma empresa real conhecida, use dados reais. Caso contrário, infira dados razoáveis com base no nome (setor provável, porte estimado, etc.).

Retorne APENAS um JSON válido com esta estrutura (use null para campos que não conseguir inferir):
{
  "razao_social": "string ou null",
  "nome_fantasia": "string ou null",
  "cnpj": "string ou null (formato 00.000.000/0000-00)",
  "setor": "string (deve ser um destes: Comércio, Serviços, Indústria, Tecnologia, Alimentação, Saúde, Construção, Educação, Agronegócio, Transporte e Logística)",
  "porte": "string (deve ser um destes: MEI, ME, EPP)",
  "regime_tributario": "string ou null (deve ser um destes: Simples Nacional, Lucro Presumido, Lucro Real, MEI)",
  "cidade": "string ou null",
  "estado": "string ou null (sigla UF com 2 letras)",
  "ano_fundacao": "number ou null"
}

IMPORTANTE: Retorne SOMENTE o JSON, sem markdown, sem explicações.`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Retorne somente JSON válido. Sem markdown, sem code blocks." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "{}";

    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {};
    }

    // Validate known fields
    const validSetores = ["Comércio", "Serviços", "Indústria", "Tecnologia", "Alimentação", "Saúde", "Construção", "Educação", "Agronegócio", "Transporte e Logística"];
    const validPortes = ["MEI", "ME", "EPP"];
    const validRegimes = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"];
    const validEstados = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

    const result = {
      razao_social: typeof parsed.razao_social === "string" ? parsed.razao_social : null,
      nome_fantasia: typeof parsed.nome_fantasia === "string" ? parsed.nome_fantasia : null,
      cnpj: typeof parsed.cnpj === "string" ? parsed.cnpj : null,
      setor: validSetores.includes(parsed.setor) ? parsed.setor : null,
      porte: validPortes.includes(parsed.porte) ? parsed.porte : null,
      regime_tributario: validRegimes.includes(parsed.regime_tributario) ? parsed.regime_tributario : null,
      cidade: typeof parsed.cidade === "string" ? parsed.cidade : null,
      estado: validEstados.includes(parsed.estado) ? parsed.estado : null,
      ano_fundacao: typeof parsed.ano_fundacao === "number" ? parsed.ano_fundacao : null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("company-lookup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
