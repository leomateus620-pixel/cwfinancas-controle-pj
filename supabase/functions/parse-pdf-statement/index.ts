import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Classification ──────────────────────────────────────────────
const CREDIT_CARD_KEYWORDS = [
  "fatura", "limite de cr", "cartão", "cartao", "compras nacionais",
  "compras internacionais", "pagamento mínimo", "pagamento minimo",
  "vencimento da fatura", "limite disponível", "limite disponivel",
  "encargos", "anuidade",
];

const BANK_KEYWORDS = [
  "extrato", "saldo anterior", "saldo final", "conta corrente",
  "agência", "agencia", "saldo disponível", "saldo disponivel",
  "cheque especial", "saldo do dia",
];

type DocType = "bank" | "credit_card" | "unknown";

function classifyDocument(text: string): DocType {
  const lower = text.toLowerCase();
  let ccScore = 0;
  let bankScore = 0;

  for (const kw of CREDIT_CARD_KEYWORDS) {
    if (lower.includes(kw)) ccScore++;
  }
  for (const kw of BANK_KEYWORDS) {
    if (lower.includes(kw)) bankScore++;
  }

  if (ccScore >= 2 && ccScore > bankScore) return "credit_card";
  if (bankScore >= 2 && bankScore > ccScore) return "bank";
  if (ccScore > 0 && bankScore === 0) return "credit_card";
  if (bankScore > 0 && ccScore === 0) return "bank";
  return "unknown";
}

// ── Noise filters ───────────────────────────────────────────────
const NOISE_PATTERNS = [
  /saldo\s*(anterior|final|do\s*dia|disponível|disponivel)/i,
  /total\s*(da\s*fatura|de\s*compras|geral|do\s*mês|do\s*mes)/i,
  /limite\s*(de\s*crédito|de\s*credito|disponível|disponivel|total)/i,
  /pagamento\s*mínimo/i,
  /pagamento\s*minimo/i,
  /encargos\s*rotativos/i,
  /crédito\s*rotativo/i,
  /^\s*$/,
  /^[\s\-=_*]+$/,
  /página|pagina|pag\./i,
  /central\s*de\s*atendimento/i,
  /ouvidoria/i,
  /sac\s/i,
];

function isNoiseLine(line: string): boolean {
  for (const pat of NOISE_PATTERNS) {
    if (pat.test(line)) return true;
  }
  return false;
}

// ── Parsing helpers ─────────────────────────────────────────────
interface ParsedTransaction {
  date: string | null;
  description: string;
  amount: number;
  original_amount: number;
  row_index: number;
}

// Match: DD/MM/YYYY or DD/MM/YY  +  description  +  value (with comma or dot)
const BANK_LINE_RE =
  /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?\s*[\d.,]+(?:\s*[CDcd])?)$/;

// Value pattern: 1.234,56 or 1234,56 or -1.234,56
function parseValue(raw: string): number | null {
  let cleaned = raw.trim().replace(/\s/g, "");
  let sign = 1;

  // Handle C/D suffix (crédito / débito)
  if (/[Cc]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
    sign = 1;
  } else if (/[Dd]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
    sign = -1;
  }

  if (cleaned.startsWith("-")) {
    sign = -1;
    cleaned = cleaned.slice(1);
  }

  // Brazilian format: 1.234,56
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * sign * 100) / 100;
}

function parseBankStatement(text: string): ParsedTransaction[] {
  const lines = text.split("\n");
  const txns: ParsedTransaction[] = [];
  let idx = 0;

  for (const line of lines) {
    if (isNoiseLine(line)) continue;

    const match = line.match(BANK_LINE_RE);
    if (match) {
      const [, dateStr, desc, valStr] = match;
      const amount = parseValue(valStr);
      if (amount !== null && desc.trim().length > 1) {
        txns.push({
          date: dateStr,
          description: desc.trim(),
          amount,
          original_amount: amount,
          row_index: idx++,
        });
      }
    }
  }

  return txns;
}

// Credit card: description + value (no date in output, invert sign)
const CC_LINE_RE = /^(.+?)\s+(-?\s*[\d.,]+)$/;

function parseCreditCardStatement(text: string): ParsedTransaction[] {
  const lines = text.split("\n");
  const txns: ParsedTransaction[] = [];
  let idx = 0;

  for (const line of lines) {
    if (isNoiseLine(line)) continue;

    // Try to strip leading date if present
    let cleanLine = line.replace(/^\d{2}\/\d{2}(?:\/\d{2,4})?\s+/, "");

    const match = cleanLine.match(CC_LINE_RE);
    if (match) {
      const [, desc, valStr] = match;
      const originalAmount = parseValue(valStr);
      if (originalAmount !== null && desc.trim().length > 2) {
        // INVERT SIGN: positive → negative, negative → positive
        const invertedAmount = originalAmount * -1;
        txns.push({
          date: null,
          description: desc.trim(),
          amount: invertedAmount,
          original_amount: originalAmount,
          row_index: idx++,
        });
      }
    }
  }

  return txns;
}

// ── PDF text extraction using pdf-parse ─────────────────────────
async function extractTextFromPdf(pdfBuffer: Uint8Array): Promise<string> {
  // Use pdf-parse via esm.sh
  const pdfParse = (await import("https://esm.sh/pdf-parse@1.1.1")).default;
  const result = await pdfParse(pdfBuffer);
  return result.text || "";
}

// ── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const uploadId = formData.get("upload_id") as string | null;
    const manualType = formData.get("manual_type") as string | null;

    if (!file || !uploadId) {
      return jsonResponse({ error: "Arquivo e upload_id são obrigatórios" }, 400);
    }

    // Validate PDF
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return jsonResponse({ error: "Apenas arquivos PDF são aceitos" }, 400);
    }

    // Update status to processing
    await supabase
      .from("pdf_statement_uploads")
      .update({ status: "processing" })
      .eq("id", uploadId)
      .eq("user_id", user.id);

    // Extract text
    const buffer = new Uint8Array(await file.arrayBuffer());
    let text: string;
    try {
      text = await extractTextFromPdf(buffer);
    } catch (e) {
      await supabase
        .from("pdf_statement_uploads")
        .update({ status: "error", error_message: "PDF ilegível ou protegido" })
        .eq("id", uploadId);
      return jsonResponse({ error: "Não foi possível ler o PDF. Verifique se o arquivo não está protegido." }, 422);
    }

    if (!text || text.trim().length < 20) {
      await supabase
        .from("pdf_statement_uploads")
        .update({ status: "error", error_message: "PDF sem texto extraível (pode ser imagem/scan)" })
        .eq("id", uploadId);
      return jsonResponse({ error: "PDF sem texto extraível. Apenas PDFs com texto selecionável são suportados." }, 422);
    }

    // Classify
    let detectedType: DocType = classifyDocument(text);
    if (manualType === "bank" || manualType === "credit_card") {
      detectedType = manualType;
    }

    // Parse transactions
    let transactions: ParsedTransaction[];
    if (detectedType === "credit_card") {
      transactions = parseCreditCardStatement(text);
    } else if (detectedType === "bank") {
      transactions = parseBankStatement(text);
    } else {
      // Try bank first, if few results try credit card
      const bankTxns = parseBankStatement(text);
      const ccTxns = parseCreditCardStatement(text);
      if (bankTxns.length >= ccTxns.length && bankTxns.length > 0) {
        transactions = bankTxns;
        detectedType = "bank";
      } else if (ccTxns.length > 0) {
        transactions = ccTxns;
        detectedType = "credit_card";
      } else {
        transactions = [];
      }
    }

    // Save to storage
    const storagePath = `${user.id}/${uploadId}.pdf`;
    await supabase.storage.from("pdf-uploads").upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    // Update upload record
    await supabase
      .from("pdf_statement_uploads")
      .update({
        status: transactions.length > 0 ? "done" : "error",
        detected_type: detectedType,
        file_path: storagePath,
        transaction_count: transactions.length,
        error_message: transactions.length === 0 ? "Nenhuma transação encontrada no documento" : null,
      })
      .eq("id", uploadId);

    // Insert parsed transactions
    if (transactions.length > 0) {
      const rows = transactions.map((t) => ({
        upload_id: uploadId,
        user_id: user.id,
        row_index: t.row_index,
        date: t.date,
        description: t.description,
        amount: t.amount,
        original_amount: t.original_amount,
        is_valid: true,
      }));

      // Batch insert (max 500 at a time)
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from("pdf_parsed_transactions").insert(rows.slice(i, i + 500));
      }
    }

    const totalLines = text.split("\n").length;
    return jsonResponse({
      detected_type: detectedType,
      transactions,
      stats: {
        total_lines: totalLines,
        valid_transactions: transactions.length,
        skipped: totalLines - transactions.length,
      },
    });
  } catch (err) {
    console.error("parse-pdf-statement error:", err);
    return jsonResponse({ error: "Erro interno no processamento" }, 500);
  }
});
