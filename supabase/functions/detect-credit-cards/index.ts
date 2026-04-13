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

// ─── Helpers ───

const INSTALLMENT_RE = /\((\d+)\/(\d+)\)/;
const PARC_RE = /PARC=/i;

const KNOWN_BANKS = [
  "unicred", "cresol", "sicredi", "nubank", "inter", "itau", "itaú",
  "bradesco", "santander", "banrisul", "c6", "safra", "btg", "original",
  "banco do brasil", "bb",
];

// Banks that should NEVER be treated as credit card accounts (only regular banking)
const EXCLUDED_FROM_CC_DETECTION = ["cresol", "CRESOL", "Cresol"];

// Banking patterns that EXCLUDE a line from being a CC merchant transaction
const BANKING_PATTERNS = [
  /\bpix\b/i, /recebimento/i, /pagamento\s*(pix|titulo|título|boleto)/i,
  /liquidac[aã]o/i, /\bted\b/i, /\bdoc\b/i,
  /transferencia/i, /transferência/i,
  /debito\s*(convenio|convênio|arrecada)/i, /débito\s*(convênio|arrecadação)/i,
  /aplic\.?\s*financ/i, /aplicacao\s*financ/i, /aplicação/i,
  /resgate\s*aplic/i,
  /saldo\s*anterior/i, /saldo\s*final/i, /saldo\s*conta/i,
  /rendimento/i,
  /tarifa/i, /taxa\s*manut/i,
  /\bboleto\b/i,
  /dep[oó]sito/i,
  /cr[eé]dito\s*sal[aá]rio/i,
  /pagamento\s*folha/i,
  /estorno.*pix/i,
];

/**
 * Determines if a transaction line looks like a merchant/CC purchase
 * (as opposed to regular banking activity like PIX, TED, etc.)
 */
function isMerchantLine(t: Transaction): boolean {
  const desc = (t.description || "").trim();
  if (!desc || desc.length < 2) return false;

  // If any banking pattern matches, it's NOT a merchant line
  if (BANKING_PATTERNS.some(p => p.test(desc))) return false;

  // Income lines are typically not CC purchases (except reimbursements within a CC block)
  // We handle reimbursements separately after block detection
  if (t.movement_type === "INCOME") return false;

  // Transfer types are not CC
  if (t.movement_type === "TRANSFER") return false;

  return true;
}

function getContaField(t: Transaction): string | null {
  const conta = t.raw_data?.Conta || t.raw_data?.conta || t.raw_data?.CONTA;
  return conta ? String(conta).trim() : null;
}

function getBancoField(t: Transaction): string | null {
  const banco = t.raw_data?.Banco || t.raw_data?.banco || t.raw_data?.BANCO;
  return banco ? String(banco).trim() : null;
}

/** Returns grouping key: prefers Conta, falls back to Banco, then "__no_conta__" */
function getGroupKey(t: Transaction): string {
  const conta = getContaField(t);
  if (conta) return conta;
  const banco = getBancoField(t);
  if (banco) return `__banco__${banco}`;
  return "__no_conta__";
}

function hasInstallment(desc: string): boolean {
  return INSTALLMENT_RE.test(desc) || PARC_RE.test(desc);
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

function extractCardLabel(groupKey: string): string {
  // Strip __banco__ prefix if present
  const raw = groupKey.startsWith("__banco__") ? groupKey.slice(9) : groupKey;
  const lower = raw.toLowerCase();
  if (/fatura\s*cc/i.test(lower)) {
    const match = raw.match(/fatura\s*cc\s+(.+)/i);
    if (match) {
      const bankName = match[1].trim();
      return `Cartão ${bankName.charAt(0).toUpperCase() + bankName.slice(1)}`;
    }
  }
  if (lower.includes("banco do brasil")) return "Cartão Banco do Brasil";
  if (lower.includes("sicredi")) return "Cartão Sicredi";
  if (lower.includes("nubank") || lower.includes("nuba")) return "Cartão Nubank";
  if (lower.includes("banrisul")) return "Cartão Banrisul";
  if (lower.includes("unicred")) return "Cartão Unicred";
  if (lower.includes("itau") || lower.includes("itaú")) return "Cartão Itaú";
  if (lower.includes("bradesco")) return "Cartão Bradesco";
  if (lower.includes("inter")) return "Cartão Inter";
  return `Cartão ${raw}`;
}

// ─── 3-Layer Block Detection ───

function detectBlocks(transactions: Transaction[]): { blocks: DetectedBlock[]; diagnosticMeta: Record<string, any> } {
  // Group all transactions by (source_tab, conta)
  const byTabConta = new Map<string, Transaction[]>();
  let faturaCC_count = 0;

  for (const t of transactions) {
    const tab = t.source_tab || "__unknown__";
    const gk = getGroupKey(t);
    const key = `${tab}|||${gk}`;
    if (!byTabConta.has(key)) byTabConta.set(key, []);
    byTabConta.get(key)!.push(t);
  }

  const blocks: DetectedBlock[] = [];
  const processedTxnIds = new Set<string>();
  // Track Layer 3 results per conta for cross-tab validation
  const layer3ResultsPerConta = new Map<string, { accepted: number; rejected: number }>();

  for (const [tabContaKey, txns] of byTabConta) {
    const [tab, conta] = tabContaKey.split("|||", 2);
    txns.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

    // ═══ LAYER 1: Explicit "Fatura CC" in Conta field ═══
    if (/fatura\s*cc/i.test(conta)) {
      faturaCC_count += txns.length;
      // Group by date
      const byDate = new Map<string, Transaction[]>();
      for (const t of txns) {
        if (processedTxnIds.has(t.id)) continue;
        if (!byDate.has(t.date)) byDate.set(t.date, []);
        byDate.get(t.date)!.push(t);
      }

      for (const [date, group] of byDate) {
        if (group.length < 2) continue;
        group.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

        const detectedTxns = group.map(t => {
          processedTxnIds.add(t.id);
          return {
            transaction: t,
            type: (t.movement_type === "INCOME" ? "reimbursement" : "expense") as "expense" | "reimbursement",
            confidence: 0.95,
            flags: { detection_path: "layer1_explicit_fatura_cc", conta, block_size: group.length },
          };
        });

        blocks.push({
          cardLabel: extractCardLabel(conta),
          banco: conta,
          dueDate: date,
          sourceTab: tab,
          startRow: group[0].source_row_number || 0,
          endRow: group[group.length - 1].source_row_number || 0,
          confidence: 0.95,
          signals: { lineCount: group.length, path: "layer1_explicit" },
          transactions: detectedTxns,
        });
      }
      continue; // Done with this conta group
    }

    // Skip contas that don't look like they could contain CC data
    // Skip only if there's truly no grouping key (no Conta AND no Banco)
    if (conta === "__no_conta__") continue;
    // Groups with __banco__ prefix are valid — they came from the Banco field fallback

    // ═══ Analyze this account's transaction distribution ═══
    const byDate = new Map<string, Transaction[]>();
    for (const t of txns) {
      if (processedTxnIds.has(t.id)) continue;
      if (!byDate.has(t.date)) byDate.set(t.date, []);
      byDate.get(t.date)!.push(t);
    }

    // Find the date with the most transactions
    let maxDate = "";
    let maxDateCount = 0;
    for (const [date, group] of byDate) {
      if (group.length > maxDateCount) {
        maxDateCount = group.length;
        maxDate = date;
      }
    }

    const totalLines = txns.filter(t => !processedTxnIds.has(t.id)).length;
    if (totalLines === 0 || maxDateCount < 5) continue;

    const concentration = maxDateCount / totalLines;
    const distinctDates = byDate.size;

    // Count merchant lines on the max date
    const maxDateGroup = byDate.get(maxDate) || [];
    const merchantOnMaxDate = maxDateGroup.filter(t => isMerchantLine(t));
    const merchantRatio = maxDateGroup.length > 0 ? merchantOnMaxDate.length / maxDateGroup.length : 0;

    // ═══ LAYER 2: Dedicated CC Account ═══
    // Account where one date concentrates >50% of lines AND >70% are merchant-like
    if (concentration > 0.5 && maxDateCount >= 15 && merchantRatio > 0.7) {
      console.log(`[detect-cc] Layer2 DEDICATED CC: conta="${conta}" tab="${tab}" date=${maxDate} lines=${maxDateCount} merchantRatio=${merchantRatio.toFixed(2)} concentration=${concentration.toFixed(2)}`);

      const group = maxDateGroup;
      group.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

      // Include ALL lines on this date (merchant + potential reimbursements)
      // Only exclude clearly banking lines
      const ccLines = group.filter(t => {
        if (BANKING_PATTERNS.some(p => p.test(t.description || ""))) return false;
        return true;
      });

      if (ccLines.length >= 10) {
        const detectedTxns = ccLines.map(t => {
          processedTxnIds.add(t.id);
          return {
            transaction: t,
            type: (t.movement_type === "INCOME" ? "reimbursement" : "expense") as "expense" | "reimbursement",
            confidence: 0.90,
            flags: { detection_path: "layer2_dedicated_cc", conta, block_size: ccLines.length, merchantRatio },
          };
        });

        blocks.push({
          cardLabel: extractCardLabel(conta),
          banco: conta,
          dueDate: maxDate,
          sourceTab: tab,
          startRow: ccLines[0].source_row_number || 0,
          endRow: ccLines[ccLines.length - 1].source_row_number || 0,
          confidence: 0.90,
          signals: { lineCount: ccLines.length, merchantRatio, concentration, path: "layer2_dedicated" },
          transactions: detectedTxns,
        });
      }

      // Also check other dates for this dedicated CC account (secondary invoice dates)
      for (const [date, dateGroup] of byDate) {
        if (date === maxDate) continue;
        const merchLines = dateGroup.filter(t => !processedTxnIds.has(t.id) && isMerchantLine(t));
        if (merchLines.length >= 10) {
          const merchRatio = merchLines.length / dateGroup.length;
          if (merchRatio > 0.6) {
            merchLines.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));
            const allCCLines = dateGroup.filter(t => !processedTxnIds.has(t.id) && !BANKING_PATTERNS.some(p => p.test(t.description || "")));
            
            const detectedTxns = allCCLines.map(t => {
              processedTxnIds.add(t.id);
              return {
                transaction: t,
                type: (t.movement_type === "INCOME" ? "reimbursement" : "expense") as "expense" | "reimbursement",
                confidence: 0.85,
                flags: { detection_path: "layer2_dedicated_cc_secondary", conta, block_size: allCCLines.length },
              };
            });

            if (detectedTxns.length >= 5) {
              blocks.push({
                cardLabel: extractCardLabel(conta),
                banco: conta,
                dueDate: date,
                sourceTab: tab,
                startRow: allCCLines[0].source_row_number || 0,
                endRow: allCCLines[allCCLines.length - 1].source_row_number || 0,
                confidence: 0.85,
                signals: { lineCount: allCCLines.length, merchantRatio: merchRatio, path: "layer2_secondary" },
                transactions: detectedTxns,
              });
            }
          }
        }
      }

      continue; // Done with this dedicated CC account
    }

    // ═══ LAYER 3: Embedded CC Block within a Bank Account ═══
    // For mixed accounts, look for ONE dominant merchant block per month (day 23, etc.)
    // Key rule: a real CC invoice appears on 1 specific day per month with 10+ merchant lines.
    // If an account has blocks on many different dates, it's a bank account, not a CC.
    if (distinctDates > 5) {
      // Collect candidate blocks per date
      const candidateBlocks: { date: string; merchantLen: number; txns: Transaction[]; reimbursements: Transaction[] }[] = [];

      for (const [date, dateGroup] of byDate) {
        const unprocessed = dateGroup.filter(t => !processedTxnIds.has(t.id));
        if (unprocessed.length < 8) continue; // Minimum 8 lines for embedded CC

        unprocessed.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

        const merchantFlags = unprocessed.map(t => isMerchantLine(t));
        
        // Find the longest contiguous merchant block
        let bestStart = -1;
        let bestLen = 0;
        let currentStart = -1;
        let currentLen = 0;
        let lastMerchantRow = -999;

        for (let i = 0; i < unprocessed.length; i++) {
          if (merchantFlags[i]) {
            const row = unprocessed[i].source_row_number || 0;
            if (currentStart === -1 || row - lastMerchantRow > 3) {
              if (currentLen > bestLen) { bestStart = currentStart; bestLen = currentLen; }
              currentStart = i;
              currentLen = 1;
            } else {
              currentLen++;
            }
            lastMerchantRow = row;
          }
        }
        if (currentLen > bestLen) { bestStart = currentStart; bestLen = currentLen; }

        // Require 10+ contiguous merchant lines for embedded CC
        if (bestLen >= 10) {
          const blockTxns = unprocessed.slice(bestStart, bestStart + bestLen);
          const startRow = blockTxns[0].source_row_number || 0;
          const endRow = blockTxns[blockTxns.length - 1].source_row_number || 0;

          const reimbursements = unprocessed.filter(t => {
            if (processedTxnIds.has(t.id)) return false;
            if (t.movement_type !== "INCOME") return false;
            const row = t.source_row_number || 0;
            return row >= startRow && row <= endRow && !blockTxns.includes(t);
          });

          candidateBlocks.push({ date, merchantLen: bestLen, txns: blockTxns, reimbursements });
        }
      }

      // Track per-conta results
      if (!layer3ResultsPerConta.has(conta)) layer3ResultsPerConta.set(conta, { accepted: 0, rejected: 0 });
      const contaStats = layer3ResultsPerConta.get(conta)!;

      // Anti-spam: a real CC invoice appears exactly ONCE per month/tab.
      if (candidateBlocks.length === 1) {
        contaStats.accepted++;
        const cb = candidateBlocks[0];
        const allBlockTxns = [...cb.txns, ...cb.reimbursements];
        allBlockTxns.sort((a, b) => (a.source_row_number || 0) - (b.source_row_number || 0));

        const confidence = cb.merchantLen >= 12 ? 0.85 : 0.75;

        console.log(`[detect-cc] Layer3 EMBEDDED CC: conta="${conta}" tab="${tab}" date=${cb.date} merchantBlock=${cb.merchantLen}`);

        const detectedTxns = allBlockTxns.map(t => {
          processedTxnIds.add(t.id);
          return {
            transaction: t,
            type: (t.movement_type === "INCOME" ? "reimbursement" : "expense") as "expense" | "reimbursement",
            confidence,
            flags: { detection_path: "layer3_embedded_cc", conta, block_size: allBlockTxns.length, merchantBlockLen: cb.merchantLen },
          };
        });

        blocks.push({
          cardLabel: extractCardLabel(conta),
          banco: conta,
          dueDate: cb.date,
          sourceTab: tab,
          startRow: allBlockTxns[0].source_row_number || 0,
          endRow: allBlockTxns[allBlockTxns.length - 1].source_row_number || 0,
          confidence,
          signals: { lineCount: allBlockTxns.length, merchantBlockLen: cb.merchantLen, path: "layer3_embedded" },
          transactions: detectedTxns,
        });
      } else if (candidateBlocks.length > 1) {
        contaStats.rejected++;
        console.log(`[detect-cc] Layer3 REJECTED (${candidateBlocks.length} blocks in tab): conta="${conta}" tab="${tab}" — likely a bank account`);
      }
    }
  }

  // ═══ Cross-tab validation: if a conta was rejected in ANY tab, purge ALL its Layer 3 blocks ═══
  for (const [conta, stats] of layer3ResultsPerConta) {
    if (stats.rejected > 0 && stats.accepted > 0) {
      console.log(`[detect-cc] Cross-tab PURGE: conta="${conta}" rejected in ${stats.rejected} tab(s), removing ${stats.accepted} accepted block(s)`);
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].banco === conta && blocks[i].signals?.path === "layer3_embedded") {
          for (const dt of blocks[i].transactions) processedTxnIds.delete(dt.transaction.id);
          blocks.splice(i, 1);
        }
      }
    }
  }

  return {
    blocks,
    diagnosticMeta: {
      faturaCC_lines_found: faturaCC_count,
      totalAccounts: byTabConta.size,
    },
  };
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
          cycles: 0, transactions: 0, status: "no_transactions",
          diagnostic: { totalTransactions: 0, suggestion: "Nenhuma transação encontrada. Sincronize a planilha primeiro." },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tabStats: Record<string, number> = {};
    for (const t of allTransactions) {
      tabStats[t.source_tab || "__unknown__"] = (tabStats[t.source_tab || "__unknown__"] || 0) + 1;
    }

    const { blocks, diagnosticMeta } = detectBlocks(allTransactions);

    console.log(`[detect-cc] user=${userId} totalTxns=${allTransactions.length} tabs=${Object.keys(tabStats).length} blocksFound=${blocks.length}`);

    if (blocks.length === 0) {
      const contaValues = new Set<string>();
      for (const t of allTransactions) {
        const c = getContaField(t);
        if (c) contaValues.add(c);
      }
      return new Response(
        JSON.stringify({
          cycles: 0, transactions: 0, status: "no_blocks_found",
          diagnostic: {
            totalTransactions: allTransactions.length,
            tabsScanned: Object.keys(tabStats),
            contaValues: Array.from(contaValues),
            ...diagnosticMeta,
            suggestion: "Nenhuma fatura de cartão detectada. Verifique se a planilha contém blocos de cartão concentrados em uma data (ex: 'Fatura CC Sicredi' ou conta dedicada de BB com 30+ linhas no mesmo dia).",
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
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(t.transaction.amount), 0);
      const reimbAmount = block.transactions
        .filter(t => t.type === "reimbursement")
        .reduce((sum, t) => sum + Math.abs(t.transaction.amount), 0);

      const blockRaw = block.transactions
        .map(t => `${t.transaction.source_row_number}|${t.transaction.amount}`)
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

      const ccTxns = block.transactions.map(dt => ({
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

      if (block.confidence < 0.7) {
        const reviewItems = block.transactions.map(dt => ({
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
