import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  client_vendor: string | null;
  source_tab: string | null;
  source_sheet_id: string | null;
  source_row_number: number | null;
  content_hash: string | null;
  notes: string | null;
  raw_data: any;
  movement_type: string;
}

interface DetectedBlock {
  cardLabel: string;
  dueDate: string;
  sourceTab: string;
  startRow: number;
  endRow: number;
  confidence: number;
  transactions: {
    transaction: Transaction;
    type: "expense" | "reimbursement";
    confidence: number;
    flags: Record<string, any>;
  }[];
}

const CC_PATTERNS = [
  /fatura\s*cc/i,
  /cart[aã]o/i,
  /credit\s*card/i,
  /fatura\s+cartao/i,
  /fatura\s+cartão/i,
];

const BANK_PATTERNS = [
  /sicr/i, /sicredi/i, /nuba/i, /nubank/i, /inter/i, /itau/i, /itaú/i,
  /bradesco/i, /santander/i, /caixa/i, /bb\b/i, /banco\s*do\s*brasil/i,
  /unicred/i, /cresol/i, /c6/i, /original/i, /safra/i, /btg/i,
];

function hasCCPattern(text: string | null): boolean {
  if (!text) return false;
  return CC_PATTERNS.some((p) => p.test(text));
}

function hasBankPattern(text: string | null): string | null {
  if (!text) return null;
  for (const p of BANK_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

function extractCardLabel(txn: Transaction): string {
  const vendor = txn.client_vendor || "";
  const ccMatch = vendor.match(/fatura\s*cc\s*(.*)/i);
  if (ccMatch) return `Fatura CC ${ccMatch[1].trim()}`.trim();
  const bank = hasBankPattern(vendor) || hasBankPattern(txn.description);
  if (bank) return `Cartão ${bank}`;
  return "Cartão Corporativo";
}

function computeRowHash(txn: Transaction): string {
  const raw = `${txn.source_tab}|${txn.source_row_number}|${txn.date}|${txn.amount}|${txn.description}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function detectBlocks(transactions: Transaction[]): DetectedBlock[] {
  const byTab = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const tab = t.source_tab || "__unknown__";
    if (!byTab.has(tab)) byTab.set(tab, []);
    byTab.get(tab)!.push(t);
  }

  const blocks: DetectedBlock[] = [];

  for (const [tab, txns] of byTab) {
    txns.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

    let i = 0;
    while (i < txns.length) {
      const t = txns[i];
      const vendorHasCC = hasCCPattern(t.client_vendor);
      const descHasCC = hasCCPattern(t.description);
      const vendorHasBank = hasBankPattern(t.client_vendor);

      if (!vendorHasCC && !descHasCC && !vendorHasBank) {
        i++;
        continue;
      }

      // Found a potential CC line — expand the block
      const blockDate = t.date;
      const blockTxns: Transaction[] = [t];
      let j = i + 1;

      while (j < txns.length) {
        const next = txns[j];
        const rowGap = (next.source_row_number || 0) - (txns[j - 1].source_row_number || 0);
        if (rowGap > 3) break; // too far apart

        const sameDate = next.date === blockDate;
        const nextHasCC = hasCCPattern(next.client_vendor) || hasCCPattern(next.description);
        const nextHasBank = !!hasBankPattern(next.client_vendor);

        if (sameDate && (nextHasCC || nextHasBank)) {
          blockTxns.push(next);
          j++;
        } else if (sameDate && rowGap <= 1) {
          // Contiguous same-date line within block context
          blockTxns.push(next);
          j++;
        } else {
          break;
        }
      }

      // Only consider blocks with 3+ lines
      if (blockTxns.length >= 3) {
        const negCount = blockTxns.filter((t) => t.amount < 0).length;
        const negRatio = negCount / blockTxns.length;
        const allHaveCC = blockTxns.every(
          (t) => hasCCPattern(t.client_vendor) || hasCCPattern(t.description)
        );

        let blockConfidence = 0.5;
        if (allHaveCC) blockConfidence = 0.95;
        else if (vendorHasCC) blockConfidence = 0.9;
        else if (vendorHasBank && negRatio > 0.6) blockConfidence = 0.85;
        else if (negRatio > 0.7) blockConfidence = 0.75;

        if (blockConfidence >= 0.6) {
          const detectedTxns = blockTxns.map((bt) => {
            const isPositive = bt.amount > 0;
            return {
              transaction: bt,
              type: (isPositive ? "reimbursement" : "expense") as "expense" | "reimbursement",
              confidence: blockConfidence,
              flags: {
                vendor_has_cc: hasCCPattern(bt.client_vendor),
                desc_has_cc: hasCCPattern(bt.description),
                vendor_has_bank: !!hasBankPattern(bt.client_vendor),
                same_date_block: true,
                block_size: blockTxns.length,
              },
            };
          });

          blocks.push({
            cardLabel: extractCardLabel(blockTxns[0]),
            dueDate: blockDate,
            sourceTab: tab,
            startRow: blockTxns[0].source_row_number || 0,
            endRow: blockTxns[blockTxns.length - 1].source_row_number || 0,
            confidence: blockConfidence,
            transactions: detectedTxns,
          });
        }
      }

      i = j;
    }
  }

  return blocks;
}

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
    const { data: transactions, error: txnError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_sheet_id", connectionId)
      .order("source_row_number", { ascending: true });

    if (txnError) throw txnError;
    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ cycles: 0, transactions: 0, reviewItems: 0, message: "No transactions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blocks = detectBlocks(transactions as Transaction[]);

    // Clear existing CC data for this connection before re-inserting
    // First delete transactions (cascade from cycles will handle this)
    const { data: existingCycles } = await adminClient
      .from("credit_card_cycles")
      .select("id")
      .eq("user_id", userId)
      .eq("connection_id", connectionId);

    if (existingCycles && existingCycles.length > 0) {
      const cycleIds = existingCycles.map((c: any) => c.id);
      // Delete transactions that are NOT manually overridden
      await adminClient
        .from("credit_card_transactions")
        .delete()
        .eq("user_id", userId)
        .in("cycle_id", cycleIds)
        .eq("is_manually_overridden", false);

      // Delete cycles that have no remaining transactions
      await adminClient
        .from("credit_card_cycles")
        .delete()
        .eq("user_id", userId)
        .eq("connection_id", connectionId);
    }

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
        .reduce((sum, t) => sum + t.transaction.amount, 0);

      // Compute block hash
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

      // Insert transactions
      const ccTxns = block.transactions.map((dt) => ({
        cycle_id: cycle.id,
        user_id: userId,
        transaction_id: dt.transaction.id,
        due_date: block.dueDate,
        transaction_type: dt.type,
        original_description: dt.transaction.description,
        amount: dt.transaction.amount,
        category_original: dt.transaction.category,
        source_account: dt.transaction.client_vendor,
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
            client_vendor: dt.transaction.client_vendor,
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

    return new Response(
      JSON.stringify({
        cycles: totalCycles,
        transactions: totalTxns,
        reviewItems: totalReview,
        batchId,
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
