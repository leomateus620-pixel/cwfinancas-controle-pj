import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Bank names that should NEVER be a category
const BANK_NAMES = [
  "sicredi", "banrisul", "unicred", "cresol", "caixa", "banco do brasil", "bb",
  "itau", "itaú", "bradesco", "santander", "nubank", "inter", "c6", "safra",
  "original", "pan", "bmg", "daycoval", "pine", "abc brasil", "votorantim",
  "pagbank", "pagseguro", "mercado pago", "stone", "cielo", "rede",
  "fatura cc", "cartao", "cartão", "asaas",
];

function looksLikeBankName(value: string): boolean {
  const v = (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!v) return false;
  // If value starts with a revenue/expense prefix, it's a category, not a bank name
  const categoryPrefixes = ["receita", "despesa", "custo", "taxa", "tarifa", "pagamento", "transferencia"];
  if (categoryPrefixes.some(p => v.startsWith(p))) return false;
  return BANK_NAMES.some(b => v.includes(b) || v === b);
}

// Category header keywords (strict)
const CATEGORY_HEADERS = ["categoria", "classificacao", "classificação", "category", "centro de custo", "plano de contas"];
const ACCOUNT_HEADERS = ["conta", "banco", "account", "conta bancaria", "instituicao", "conta banco"];

function findCategoryColumn(rawData: Record<string, unknown>): { categoryCol: string | null; accountCol: string | null } {
  const keys = Object.keys(rawData);
  let categoryCol: string | null = null;
  let accountCol: string | null = null;

  for (const key of keys) {
    const norm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!categoryCol && CATEGORY_HEADERS.some(h => norm === h || norm.includes(h))) {
      categoryCol = key;
    }
    if (!accountCol && ACCOUNT_HEADERS.some(h => norm === h || norm.includes(h))) {
      accountCol = key;
    }
  }

  return { categoryCol, accountCol };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { connection_id, fix_descriptions } = body;

    console.log(`[rebuild-categories] User: ${userId}, Connection: ${connection_id || "ALL"}, fixDescriptions: ${!!fix_descriptions}`);

    // Fetch transactions with raw_data
    let query = supabase
      .from("transactions")
      .select("id, category, description, raw_data, source_tab, source_sheet_id, movement_type")
      .eq("user_id", userId)
      .eq("source", "sheets")
      .neq("movement_type", "TRANSFER")
      .not("raw_data", "is", null);

    if (connection_id) {
      query = query.eq("source_sheet_id", connection_id);
    }

    // Process in pages
    let totalFixed = 0;
    let totalChecked = 0;
    let totalAlreadyOk = 0;
    let descriptionsFixed = 0;
    const pageSize = 500;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: transactions, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        console.error("Error fetching transactions:", error);
        break;
      }
      if (!transactions || transactions.length === 0) break;
      hasMore = transactions.length === pageSize;
      from += pageSize;

      for (const tx of transactions) {
        totalChecked++;
        const rawData = tx.raw_data as Record<string, unknown> | null;
        if (!rawData) continue;

        const updates: Record<string, unknown> = {};

        // === Fix descriptions ===
        if (fix_descriptions) {
          const currentDesc = (tx.description || "").trim();
          if (currentDesc === "Sem descrição" || currentDesc === "") {
            // Look for alternative description columns in raw_data
            let bestDesc = "";
            for (const [key, val] of Object.entries(rawData)) {
              const norm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              if ((norm.includes("descricao") || norm.includes("description") || norm.includes("historico")) && val) {
                const v = String(val).trim();
                if (v && v.length > bestDesc.length) {
                  bestDesc = v;
                }
              }
            }
            if (bestDesc && bestDesc !== currentDesc) {
              updates.description = bestDesc;
            }
          }
        }

        // === Fix categories ===
        const { categoryCol, accountCol } = findCategoryColumn(rawData);
        let newCategory: string | null = null;

        if (categoryCol) {
          const rawCat = String(rawData[categoryCol] || "").trim();
          if (rawCat && !looksLikeBankName(rawCat)) {
            newCategory = rawCat;
          } else if (rawCat && looksLikeBankName(rawCat)) {
            if (accountCol) {
              const rawAcc = String(rawData[accountCol] || "").trim();
              if (rawAcc && !looksLikeBankName(rawAcc)) {
                newCategory = rawAcc;
              }
            }
          }
        } else if (!categoryCol && accountCol) {
          const rawAcc = String(rawData[accountCol] || "").trim();
          if (rawAcc && !looksLikeBankName(rawAcc)) {
            newCategory = rawAcc;
          }
        }

        if (!newCategory) {
          for (const [key, val] of Object.entries(rawData)) {
            const norm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if ((norm.includes("categoria") || norm.includes("classificacao")) && val) {
              const v = String(val).trim();
              if (v && !looksLikeBankName(v)) {
                newCategory = v;
                break;
              }
            }
          }
        }

        if (!newCategory) newCategory = "Sem categoria";

        const currentCategory = tx.category || "";
        const currentIsBad = looksLikeBankName(currentCategory) || currentCategory === "Geral" || currentCategory === "Sem categoria";
        const newIsDifferent = newCategory !== currentCategory;

        if (currentIsBad && newIsDifferent) {
          updates.category = newCategory;
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("transactions")
            .update(updates)
            .eq("id", tx.id);

          if (updateError) {
            console.error(`Error updating tx ${tx.id}:`, updateError.message);
          } else {
            if (updates.category) totalFixed++;
            if (updates.description) descriptionsFixed++;
          }
        } else {
          totalAlreadyOk++;
        }
      }

      console.log(`[rebuild-categories] Progress: checked=${totalChecked}, fixed=${totalFixed}, descriptions=${descriptionsFixed}, ok=${totalAlreadyOk}`);
    }

    console.log(`[rebuild-categories] DONE: checked=${totalChecked}, fixed=${totalFixed}, descriptions=${descriptionsFixed}, alreadyOk=${totalAlreadyOk}`);

    return new Response(JSON.stringify({
      success: true,
      total_checked: totalChecked,
      total_fixed: totalFixed,
      descriptions_fixed: descriptionsFixed,
      total_already_ok: totalAlreadyOk,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error in rebuild-categories:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
