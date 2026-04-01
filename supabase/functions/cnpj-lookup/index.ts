import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (slice: string, weights: number[]): number => {
    const sum = slice.split("").reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(digits.slice(0, 12), w1);
  if (Number(digits[12]) !== d1) return false;
  const d2 = calc(digits.slice(0, 13), w2);
  return Number(digits[13]) === d2;
}

interface NormalizedCompany {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  situacao_cadastral: string | null;
  natureza_juridica: string | null;
  data_abertura: string | null;
  ano_fundacao: number | null;
  cnae_principal: string | null;
  cnaes_secundarios: string[] | null;
  porte: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  setor: string | null;
  regime_tributario: string | null;
  quadro_societario: any[] | null;
  source: string;
}

function inferSetor(cnaeDesc: string): string | null {
  const d = (cnaeDesc || "").toLowerCase();
  if (d.includes("tecnologia") || d.includes("software") || d.includes("informática") || d.includes("informacao")) return "Tecnologia";
  if (d.includes("comércio") || d.includes("comercio") || d.includes("varejo") || d.includes("atacado")) return "Comércio";
  if (d.includes("aliment") || d.includes("restaur") || d.includes("bar")) return "Alimentação";
  if (d.includes("saúde") || d.includes("saude") || d.includes("médic") || d.includes("medic") || d.includes("hospital")) return "Saúde";
  if (d.includes("constru")) return "Construção";
  if (d.includes("educa") || d.includes("ensino")) return "Educação";
  if (d.includes("transport") || d.includes("logíst") || d.includes("logist")) return "Transporte e Logística";
  if (d.includes("agro") || d.includes("pecuár") || d.includes("agrícol")) return "Agronegócio";
  if (d.includes("indústr") || d.includes("industri") || d.includes("fabric")) return "Indústria";
  return "Serviços";
}

function inferPorte(porteStr: string): string | null {
  const p = (porteStr || "").toUpperCase();
  if (p.includes("MEI")) return "MEI";
  if (p.includes("MICRO") || p.includes("ME")) return "ME";
  if (p.includes("PEQUENO") || p.includes("EPP")) return "EPP";
  return "ME";
}

function normalizeBrasilAPI(data: any): NormalizedCompany {
  const cnaeDesc = data.cnae_fiscal_descricao || "";
  const porteStr = data.porte || data.descricao_porte || "";
  const year = data.data_inicio_atividade ? new Date(data.data_inicio_atividade).getFullYear() : null;

  return {
    razao_social: data.razao_social || null,
    nome_fantasia: data.nome_fantasia || null,
    cnpj: data.cnpj || null,
    situacao_cadastral: data.descricao_situacao_cadastral || null,
    natureza_juridica: data.natureza_juridica || null,
    data_abertura: data.data_inicio_atividade || null,
    ano_fundacao: year,
    cnae_principal: cnaeDesc ? `${data.cnae_fiscal || ""} - ${cnaeDesc}` : null,
    cnaes_secundarios: (data.cnaes_secundarios || []).map((c: any) => `${c.codigo} - ${c.descricao}`),
    porte: inferPorte(porteStr),
    endereco: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ") || null,
    cidade: data.municipio || null,
    estado: data.uf || null,
    cep: data.cep || null,
    telefone: data.ddd_telefone_1 || null,
    email: data.email || null,
    setor: inferSetor(cnaeDesc),
    regime_tributario: data.opcao_pelo_simples ? "Simples Nacional" : null,
    quadro_societario: data.qsa || null,
    source: "BrasilAPI (Receita Federal)",
  };
}

function normalizeReceitaWS(data: any): NormalizedCompany {
  const cnaeDesc = data.atividade_principal?.[0]?.text || "";
  const porteStr = data.porte || "";
  const year = data.abertura ? new Date(data.abertura.split("/").reverse().join("-")).getFullYear() : null;

  return {
    razao_social: data.nome || null,
    nome_fantasia: data.fantasia || null,
    cnpj: data.cnpj || null,
    situacao_cadastral: data.situacao || null,
    natureza_juridica: data.natureza_juridica || null,
    data_abertura: data.abertura || null,
    ano_fundacao: year,
    cnae_principal: cnaeDesc ? `${data.atividade_principal?.[0]?.code || ""} - ${cnaeDesc}` : null,
    cnaes_secundarios: (data.atividades_secundarias || []).map((a: any) => `${a.code} - ${a.text}`),
    porte: inferPorte(porteStr),
    endereco: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ") || null,
    cidade: data.municipio || null,
    estado: data.uf || null,
    cep: data.cep || null,
    telefone: data.telefone || null,
    email: data.email || null,
    setor: inferSetor(cnaeDesc),
    regime_tributario: data.simples?.optante ? "Simples Nacional" : null,
    quadro_societario: data.qsa || null,
    source: "ReceitaWS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    if (!cnpj || typeof cnpj !== "string") {
      return new Response(JSON.stringify({ error: "CNPJ é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digits = cnpj.replace(/\D/g, "");
    if (!validateCNPJ(digits)) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Source 1: BrasilAPI
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeBrasilAPI(data);
        return new Response(JSON.stringify(normalized), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("BrasilAPI returned", res.status);
    } catch (e) {
      console.log("BrasilAPI failed:", e);
    }

    // Source 2: ReceitaWS
    try {
      const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status !== "ERROR") {
          const normalized = normalizeReceitaWS(data);
          return new Response(JSON.stringify(normalized), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      console.log("ReceitaWS returned error or non-200");
    } catch (e) {
      console.log("ReceitaWS failed:", e);
    }

    // Source 3: AI fallback
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const prompt = `Busque dados cadastrais da empresa com CNPJ ${digits}. Retorne APENAS JSON válido:
{
  "razao_social": "string ou null",
  "nome_fantasia": "string ou null",
  "setor": "string (Comércio, Serviços, Indústria, Tecnologia, Alimentação, Saúde, Construção, Educação, Agronegócio, Transporte e Logística)",
  "porte": "MEI, ME ou EPP",
  "cidade": "string ou null",
  "estado": "UF 2 letras ou null",
  "ano_fundacao": "number ou null"
}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Retorne somente JSON válido." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (aiRes.ok) {
          const aiResult = await aiRes.json();
          const content = aiResult.choices?.[0]?.message?.content ?? "{}";
          const cleaned = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);

          return new Response(JSON.stringify({
            ...parsed,
            cnpj: digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
            source: "IA (dados podem ser imprecisos)",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.log("AI fallback failed:", e);
    }

    return new Response(JSON.stringify({ error: "Não foi possível consultar os dados do CNPJ" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("cnpj-lookup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
