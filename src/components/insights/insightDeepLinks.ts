/**
 * Build navigation links from insight text content.
 * Pattern-matches categories, DRE references, and keywords in AI-generated text.
 */

export interface InsightLink {
  label: string;
  path: string;
}

const categoryPatterns: Record<string, { path: string; type: "expense" | "income" }> = {
  "pró-labore": { path: "/expenses", type: "expense" },
  "prolabore": { path: "/expenses", type: "expense" },
  "comissões": { path: "/income", type: "income" },
  "comissão": { path: "/income", type: "income" },
  "alimentação": { path: "/expenses", type: "expense" },
  "aluguel": { path: "/expenses", type: "expense" },
  "tarifa": { path: "/expenses", type: "expense" },
  "tarifas bancárias": { path: "/expenses", type: "expense" },
  "impostos": { path: "/expenses", type: "expense" },
  "frete": { path: "/expenses", type: "expense" },
  "marketing": { path: "/expenses", type: "expense" },
  "salário": { path: "/expenses", type: "expense" },
  "salários": { path: "/expenses", type: "expense" },
  "receita": { path: "/income", type: "income" },
  "faturamento": { path: "/income", type: "income" },
  "vendas": { path: "/income", type: "income" },
};

export function buildInsightLinks(text: string): InsightLink[] {
  const links: InsightLink[] = [];
  const lowerText = text.toLowerCase();
  const seen = new Set<string>();

  // Category matches
  for (const [keyword, config] of Object.entries(categoryPatterns)) {
    if (lowerText.includes(keyword) && !seen.has(config.path + keyword)) {
      seen.add(config.path + keyword);
      const label = config.type === "expense" ? "Ver despesas" : "Ver receitas";
      links.push({
        label: `${label}: ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`,
        path: `${config.path}?search=${encodeURIComponent(keyword)}`,
      });
    }
  }

  // DRE references
  if (lowerText.includes("dre") || lowerText.includes("demonstrativo") || lowerText.includes("margem")) {
    if (!seen.has("dre")) {
      seen.add("dre");
      links.push({ label: "Ir para DRE", path: "/dre" });
    }
  }

  // Cash flow references
  if (lowerText.includes("caixa") || lowerText.includes("fluxo de caixa") || lowerText.includes("liquidez")) {
    if (!seen.has("cash-flow")) {
      seen.add("cash-flow");
      links.push({ label: "Ver fluxo de caixa", path: "/cash-flow" });
    }
  }

  // Forecast references
  if (lowerText.includes("previsão") || lowerText.includes("projeção") || lowerText.includes("forecast")) {
    if (!seen.has("forecasts")) {
      seen.add("forecasts");
      links.push({ label: "Ver previsões", path: "/forecasts" });
    }
  }

  // Generic fallback to transactions
  if (links.length === 0) {
    if (lowerText.includes("despesa") || lowerText.includes("custo") || lowerText.includes("gasto")) {
      links.push({ label: "Ver despesas", path: "/expenses" });
    } else if (lowerText.includes("receita") || lowerText.includes("entrada")) {
      links.push({ label: "Ver receitas", path: "/income" });
    }
  }

  return links.slice(0, 3);
}
