import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  movement_type: string;
  client_vendor: string | null;
  source_tab: string | null;
  source_sheet_id: string | null;
  source_row_number: number | null;
  content_hash: string | null;
  notes: string | null;
  raw_data: any;
}

interface DetectedBlock {
  cardLabel: string;
  banco: string;
  dueDate: string;
  sourceTab: string;
  startRow: number;
  endRow: number;
  confidence: number;
  signals: Record<string, any>;
  transactions: {
    transaction: Transaction;
    type: "expense" | "reimbursement";
    confidence: number;
    flags: Record<string, any>;
  }[];
}

interface DiagnosticGroup {
  tab: string;
  date: string;
  banco: string;
  lineCount: number;
  score: number;
  rejectionReason: string;
  signals: Record<string, any>;
}

// ─── Helpers ───

const INSTALLMENT_RE = /\((\d+)\/(\d+)\)/;
const PARC_RE = /PARC=/i;
const CC_PATTERNS = [/fatura\s*cc/i, /cart[aã]o/i, /credit\s*card/i, /fatura\s+cart[aã]o/i];
const KNOWN_BANKS = ["unicred", "cresol", "sicredi", "nubank", "inter", "itau", "itaú", "bradesco", "santander", "banrisul", "c6", "safra", "btg", "original", "bb"];

function extractBanco(t: Transaction): string | null {
  const fromRaw = t.raw_data?.Banco || t.raw_data?.banco || t.raw_data?.BANCO;
  if (fromRaw) return String(fromRaw).trim();
  const vendor = t.client_vendor;
  if (vendor) {
    const lower = vendor.toLowerCase();
    for (const b of KNOWN_BANKS) {
      if (lower.includes(b)) return vendor.trim();
    }
  }
  return null;
}

function hasCCPattern(text: string | null): boolean {
  if (!text) return false;
  return CC_PATTERNS.some((p) => p.test(text));
}

function hasInstallment(desc: string): boolean {
  return INSTALLMENT_RE.test(desc) || PARC_RE.test(desc);
}

function isKnownBank(banco: string): boolean {
  const lower = banco.toLowerCase();
  return KNOWN_BANKS.some((b) => lower.includes(b));
}

function computeRowHash(t: Transaction): string {
  const raw = `${t.source_tab}|${t.source_row_number}|${t.date}|${t.amount}|${t.description}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractCardLabel(banco: string): string {
  const lower = banco.toLowerCase();
  if (lower.includes("unicred")) return "Cartão Unicred";
  if (lower.includes("cresol")) return "Cartão Cresol";
  if (lower.includes("sicredi") || lower.includes("sicr")) return "Cartão Sicredi";
  if (lower.includes("nubank") || lower.includes("nuba") || lower === "nu") return "Cartão Nubank";
  if (lower.includes("banrisul") || lower.includes("banri")) return "Cartão Banrisul";
  if (lower.includes("inter")) return "Cartão Inter";
  if (lower.includes("itau") || lower.includes("itaú")) return "Cartão Itaú";
  if (lower.includes("bradesco")) return "Cartão Bradesco";
  return `Cartão ${banco}`;
}

// ─── Block detection ───

function detectBlocks(transactions: Transaction[]): { blocks: DetectedBlock[]; diagnosticGroups: DiagnosticGroup[] } {
  const byTab = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const tab = t.source_tab || "__unknown__";
    if (!byTab.has(tab)) byTab.set(tab, []);
    byTab.get(tab)!.push(t);
  }

  const blocks: DetectedBlock[] = [];
  const diagnosticGroups: DiagnosticGroup[] = [];

  for (const [tab, txns] of byTab) {
    txns.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

    // ─── Strategy 1: Fast-path — "Fatura CC" in vendor or description ───
    // (kept from original for high-confidence matches)
    
    // ─── Strategy 2: Group by (date + banco) for block detection ───
    const groups = new Map<string, Transaction[]>();
    for (const t of txns) {
      const banco = extractBanco(t);
      if (!banco) continue;
      const key = `${t.date}|${banco}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    for (const [key, group] of groups) {
      const [date, banco] = key.split("|", 2);
      
      if (group.length < 3) continue; // Need at least 3 lines for a block

      // Sort by row number
      group.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

      // ─── Calculate signals ───
      const expenseCount = group.filter(t => t.movement_type === "EXPENSE").length;
      const incomeCount = group.filter(t => t.movement_type === "INCOME").length;
      const expenseRatio = expenseCount / group.length;
      
      const installmentCount = group.filter(t => hasInstallment(t.description)).length;
      const hasFaturaCC = group.some(t => hasCCPattern(t.client_vendor) || hasCCPattern(t.description));
      const bancoIsKnown = isKnownBank(banco);
      
      // Check contiguity (are rows mostly adjacent?)
      let contiguousCount = 0;
      for (let i = 1; i < group.length; i++) {
        const gap = (group[i].source_row_number || 0) - (group[i - 1].source_row_number || 0);
        if (gap <= 2) contiguousCount++;
      }
      const contiguityRatio = group.length > 1 ? contiguousCount / (group.length - 1) : 0;

      // Short merchant-like descriptions (typical of CC statements)
      const shortDescCount = group.filter(t => t.description.length <= 30 && t.description.length > 2).length;
      const shortDescRatio = shortDescCount / group.length;

      const signals = {
        lineCount: group.length,
        expenseRatio,
        installmentCount,
        hasFaturaCC,
        bancoIsKnown,
        contiguityRatio,
        shortDescRatio,
        incomeCount,
      };

      // ─── Calculate confidence score ───
      let confidence = 0;

      if (hasFaturaCC) {
        confidence = 0.95;
      } else {
        // Base: known bank with 3+ lines same date
        if (bancoIsKnown && group.length >= 3) confidence = 0.5;
        
        // Boost for installments
        if (installmentCount >= 2) confidence += 0.15;
        else if (installmentCount >= 1) confidence += 0.08;
        
        // Boost for expense ratio
        if (expenseRatio >= 0.8) confidence += 0.1;
        else if (expenseRatio >= 0.6) confidence += 0.05;
        
        // Boost for contiguity
        if (contiguityRatio >= 0.8) confidence += 0.1;
        
        // Boost for block size (more lines = more likely a CC statement)
        if (group.length >= 15) confidence += 0.1;
        else if (group.length >= 8) confidence += 0.05;
        
        // Boost for short descriptions
        if (shortDescRatio >= 0.7) confidence += 0.05;
      }

      confidence = Math.min(confidence, 0.99);

      if (confidence >= 0.6) {
        const detectedTxns = group.map((t) => {
          const isIncome = t.movement_type === "INCOME";
          return {
            transaction: t,
            type: (isIncome ? "reimbursement" : "expense") as "expense" | "reimbursement",
            confidence,
            flags: {
              banco,
              has_installment: hasInstallment(t.description),
              movement_type: t.movement_type,
              block_size: group.length,
            },
          };
        });

        blocks.push({
          cardLabel: extractCardLabel(banco),
          banco,
          dueDate: date,
          sourceTab: tab,
          startRow: group[0].source_row_number || 0,
          endRow: group[group.length - 1].source_row_number || 0,
          confidence,
          signals,
          transactions: detectedTxns,
        });
      } else if (confidence >= 0.3) {
        // Near-miss — record for diagnostics
        diagnosticGroups.push({
          tab,
          date,
          banco,
          lineCount: group.length,
          score: confidence,
          rejectionReason: confidence < 0.6
            ? `Score ${confidence.toFixed(2)} below threshold 0.6. Signals: expenseRatio=${expenseRatio.toFixed(2)}, installments=${installmentCount}, contiguity=${contiguityRatio.toFixed(2)}`
            : "unknown",
          signals,
        });
      }
    }
  }

  return { blocks, diagnosticGroups };
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch all transactions for this connection
    const allTransactions: Transaction[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await adminClient
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("source_sheet_id", connectionId)
        .order("source_row_number", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allTransactions.push(...(data as Transaction[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allTransactions.length === 0) {
      return new Response(
        JSON.stringify({
          cycles: 0,
          transactions: 0,
          status: "no_transactions",
          diagnostic: {
            totalTransactions: 0,
            tabsScanned: [],
            suggestion: "Nenhuma transação encontrada para esta planilha. Sincronize a planilha primeiro.",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect tab stats
    const tabStats: Record<string, number> = {};
    for (const t of allTransactions) {
      const tab = t.source_tab || "__unknown__";
      tabStats[tab] = (tabStats[tab] || 0) + 1;
    }

    const { blocks, diagnosticGroups } = detectBlocks(allTransactions);

    console.log(`[detect-cc] user=${userId} connection=${connectionId} totalTxns=${allTransactions.length} tabs=${Object.keys(tabStats).length} blocksFound=${blocks.length} diagnosticGroups=${diagnosticGroups.length}`);

    if (blocks.length === 0) {
      return new Response(
        JSON.stringify({
          cycles: 0,
          transactions: 0,
          status: "no_blocks_found",
          diagnostic: {
            totalTransactions: allTransactions.length,
            tabsScanned: Object.keys(tabStats),
            transactionsPerTab: tabStats,
            candidateGroups: diagnosticGroups.length,
            rejectedGroups: diagnosticGroups.slice(0, 10),
            suggestion: diagnosticGroups.length > 0
              ? `Encontrados ${diagnosticGroups.length} grupos candidatos, mas nenhum atingiu confiança mínima de 0.6. Verifique se a planilha contém blocos de cartão com datas repetidas e banco identificável.`
              : "Nenhum grupo de linhas com mesma data e banco foi encontrado. Verifique se a coluna 'Banco' está preenchida na planilha.",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Clear existing CC data for this connection ───
    const { data: existingCycles } = await adminClient
      .from("credit_card_cycles")
      .select("id")
      .eq("user_id", userId)
      .eq("connection_id", connectionId);

    if (existingCycles && existingCycles.length > 0) {
      const cycleIds = existingCycles.map((c: any) => c.id);
      await adminClient
        .from("credit_card_transactions")
        .delete()
        .eq("user_id", userId)
        .in("cycle_id", cycleIds)
        .eq("is_manually_overridden", false);

      await adminClient
        .from("credit_card_cycles")
        .delete()
        .eq("user_id", userId)
        .eq("connection_id", connectionId);
    }

    // ─── Persist blocks ───
    const batchId = crypto.randomUUID();
    let totalCycles = 0;
    let totalTxns = 0;
    let totalReview = 0;

    for (const block of blocks) {
      const grossAmount = block.transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(t.transaction.amount), 0);
      const reimbAmount = block.transactions
        .filter((t) => t.type === "reimbursement")
        .reduce((sum, t) => sum + Math.abs(t.transaction.amount), 0);

      const blockRaw = block.transactions
        .map((t) => `${t.transaction.source_row_number}|${t.transaction.amount}`)
        .join(";");
      let bHash = 0;
      for (let i = 0; i < blockRaw.length; i++) {
        bHash = ((bHash << 5) - bHash) + blockRaw.charCodeAt(i);
        bHash |= 0;
      }

      const cycleStatus = block.confidence >= 0.7 ? "validated" : "needs_review";

      const { data: cycle, error: cycleErr } = await adminClient
        .from("credit_card_cycles")
        .insert({
          user_id: userId,
          connection_id: connectionId,
          card_label: block.cardLabel,
          period_key: block.dueDate.substring(0, 7),
          due_date: block.dueDate,
          source_sheet_id: connectionId,
          source_tab: block.sourceTab,
          cycle_start_row: block.startRow,
          cycle_end_row: block.endRow,
          detection_confidence: block.confidence,
          gross_amount: grossAmount,
          reimbursement_amount: reimbAmount,
          net_amount: grossAmount - reimbAmount,
          transaction_count: block.transactions.length,
          status: cycleStatus,
          raw_block_hash: Math.abs(bHash).toString(36),
          import_batch_id: batchId,
        })
        .select("id")
        .single();

      if (cycleErr) {
        console.error("Cycle insert error:", cycleErr);
        continue;
      }

      totalCycles++;

      const ccTxns = block.transactions.map((dt) => ({
        cycle_id: cycle.id,
        user_id: userId,
        transaction_id: dt.transaction.id,
        due_date: block.dueDate,
        transaction_type: dt.type,
        original_description: dt.transaction.description,
        amount: dt.transaction.amount,
        category_original: dt.transaction.category,
        source_account: block.banco,
        source_row_number: dt.transaction.source_row_number,
        row_hash: computeRowHash(dt.transaction),
        detection_confidence: dt.confidence,
        detection_flags: dt.flags,
      }));

      const { error: txnInsertErr } = await adminClient
        .from("credit_card_transactions")
        .insert(ccTxns);

      if (txnInsertErr) {
        console.error("CC txn insert error:", txnInsertErr);
      } else {
        totalTxns += ccTxns.length;
      }

      // Send low-confidence items to review
      if (block.confidence < 0.7) {
        const reviewItems = block.transactions.map((dt) => ({
          user_id: userId,
          transaction_id: dt.transaction.id,
          source_tab: block.sourceTab,
          source_row_number: dt.transaction.source_row_number,
          row_hash: computeRowHash(dt.transaction),
          raw_snapshot: {
            description: dt.transaction.description,
            amount: dt.transaction.amount,
            category: dt.transaction.category,
            banco: block.banco,
            date: dt.transaction.date,
          },
          reason_flag: "low_confidence_block",
          suggested_action: "review",
          confidence: dt.confidence,
        }));

        const { error: reviewErr } = await adminClient
          .from("credit_card_review_queue")
          .insert(reviewItems);

        if (!reviewErr) totalReview += reviewItems.length;
      }
    }

    console.log(`[detect-cc] DONE user=${userId} cycles=${totalCycles} txns=${totalTxns} review=${totalReview}`);

    return new Response(
      JSON.stringify({
        cycles: totalCycles,
        transactions: totalTxns,
        reviewItems: totalReview,
        batchId,
        status: "success",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("detect-credit-cards error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
