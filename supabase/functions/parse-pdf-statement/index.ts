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

// ── Safe base64 encoding (no stack overflow) ────────────────────
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(""));
}

// ── Classification ──────────────────────────────────────────────
const CREDIT_CARD_KEYWORDS = [
  "fatura", "nubank", "compras nacionais", "compras internacionais",
  "pagamento mínimo", "pagamento minimo", "vencimento da fatura",
  "limite disponível", "limite disponivel", "rotativo",
  "parcela", "cartão de crédito", "cartao de credito",
  "nu pagamentos", "resumo da fatura",
];

const BANK_KEYWORDS = [
  "extrato", "saldo anterior", "saldo ant", "saldo final", "conta corrente",
  "agência", "agencia", "saldo disponível", "saldo disponivel",
  "cheque especial", "saldo do dia", "saldo na data",
  "movimentos da conta", "pix recebido", "pix enviado",
  "aplicacao automatica", "aplicação automática", "resgate automatico",
  "resgate automático", "banrisul", "banco do brasil", "bradesco",
  "itau", "itaú", "caixa economica", "vero deb", "vero ant",
  "pagamento titulo", "pagamento título", "cheque compensado",
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
  /saldo\s*(anterior|final|do\s*dia|disponível|disponivel|ant\s+em)/i,
  /total\s*(da\s*fatura|de\s*compras|geral|do\s*mês|do\s*mes|a\s*pagar)/i,
  /limite\s*(de\s*crédito|de\s*credito|disponível|disponivel|total|da\s*conta)/i,
  /pagamento\s*m[ií]nimo/i,
  /encargos\s*rotativos/i,
  /crédito\s*rotativo/i,
  /^\s*$/,
  /^[\s\-=_*+]+$/,
  /página|pagina|pag\./i,
  /central\s*de\s*atendimento/i,
  /ouvidoria/i,
  /\bsac\s/i,
  /saldo\s*devedor/i,
  /invest\s*resgate/i,
  /saldo\s*livre/i,
  /saldo\s*inicial/i,
  /taxa\s*de\s*juros/i,
  /custo\s*efetivo/i,
  /banricompras/i,
  /cdb\s*automatico/i,
  /tarifa\s*economica/i,
  /^\s*NOME:/i,
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

function parseValue(raw: string): number | null {
  let cleaned = raw.trim().replace(/\s/g, "");
  let sign = 1;

  // Handle trailing C/D (credit/debit markers)
  if (/[Cc]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
    sign = 1;
  } else if (/[Dd]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
    sign = -1;
  }

  // Handle trailing minus (Banrisul style: 82,97-)
  if (cleaned.endsWith("-")) {
    sign = -1;
    cleaned = cleaned.slice(0, -1);
  }

  // Handle leading minus
  if (cleaned.startsWith("-")) {
    sign = -1;
    cleaned = cleaned.slice(1);
  }

  // Remove R$ prefix
  cleaned = cleaned.replace(/^R\$\s*/, "");

  // Brazilian format: 1.234,56 → 1234.56
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * sign * 100) / 100;
}

// ── Bank statement parser (Banrisul-style + generic) ────────────
function parseBankStatement(text: string): ParsedTransaction[] {
  const lines = text.split("\n");
  const txns: ParsedTransaction[] = [];
  let idx = 0;
  let currentDay: string | null = null;

  // Pattern 1: DD/MM/YYYY desc valor
  const fullDateRe = /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?\s*[\d.,]+(?:\s*[CDcd])?)$/;
  // Pattern 2: DD HISTORICO DOCUMENTO VALOR (Banrisul)
  // e.g. "30 VERO DEB BLF 322356 49,50"
  // e.g. "PAGAMENTO TITULO 680924 82,97-"
  // e.g. "PIX RECEBIDO 414186 2.300,00"
  const banrisulRe = /^(\d{2})?\s*(.+?)\s+(\d{3,})\s+([\d.,]+[-]?)$/;
  // Pattern 3: lines with just desc + value (continuation)
  const simpleValRe = /^(.+?)\s+([\d.,]+[-]?)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isNoiseLine(line)) continue;

    // Try full date pattern first
    const fullMatch = line.match(fullDateRe);
    if (fullMatch) {
      const [, dateStr, desc, valStr] = fullMatch;
      const amount = parseValue(valStr);
      if (amount !== null && desc.trim().length > 1) {
        txns.push({ date: dateStr, description: desc.trim(), amount, original_amount: Math.abs(amount), row_index: idx++ });
      }
      continue;
    }

    // Detect day change lines (just a number 01-31 at start)
    const dayMatch = line.match(/^(\d{2})\s+(.+)/);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1]);
      if (dayNum >= 1 && dayNum <= 31) {
        currentDay = dayMatch[1];
      }
    }

    // Banrisul pattern: DESC DOC_NUMBER VALUE[-]
    const banriMatch = line.match(banrisulRe);
    if (banriMatch) {
      let dayStr = banriMatch[1] || currentDay;
      const desc = banriMatch[2].trim();
      const valStr = banriMatch[4];
      const amount = parseValue(valStr);

      // Skip noise descriptions
      if (amount !== null && desc.length > 2 && !isNoiseLine(desc)) {
        txns.push({
          date: dayStr || null,
          description: desc,
          amount,
          original_amount: Math.abs(amount),
          row_index: idx++,
        });
      }
    }
  }

  return txns;
}

// ── Credit card parser (Nubank-style + generic) ─────────────────
function parseCreditCardStatement(text: string): ParsedTransaction[] {
  const lines = text.split("\n");
  const txns: ParsedTransaction[] = [];
  let idx = 0;

  // Nubank pattern: DD MMM .... NNNN Description R$ value
  // e.g. "05 MAR .... 3801 Porto Seguro Cia Seg G - Parcela 6/10 R$ 147,47"
  const nubankRe = /^(\d{2}\s+\w{3})\s+\.\.\.\.\s*\d{4}\s+(.+?)\s+R\$\s*([\d.,]+)$/;

  // Generic: DD/MM desc R$ value or desc R$ value
  const genericRe = /^(?:\d{2}\/\d{2}(?:\/\d{2,4})?\s+)?(.+?)\s+R\$\s*([\d.,]+)$/;

  // Simple: desc value (no R$ prefix)
  const simpleRe = /^(.+?)\s+(-?\s*[\d.,]+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isNoiseLine(line)) continue;

    // Skip payment/financing lines
    if (/pagamento\s+(em|recebido)/i.test(line)) continue;
    if (/saldo\s+restante/i.test(line)) continue;
    if (/fatura\s+anterior/i.test(line)) continue;

    // Nubank format
    const nubankMatch = line.match(nubankRe);
    if (nubankMatch) {
      const [, dateStr, desc, valStr] = nubankMatch;
      const originalAmount = parseValue(valStr);
      if (originalAmount !== null && desc.trim().length > 2) {
        // Credit card: invert signs (purchases are expenses = negative)
        txns.push({
          date: dateStr,
          description: desc.trim(),
          amount: -Math.abs(originalAmount),
          original_amount: Math.abs(originalAmount),
          row_index: idx++,
        });
      }
      continue;
    }

    // Generic with R$
    const genericMatch = line.match(genericRe);
    if (genericMatch) {
      const [, desc, valStr] = genericMatch;
      const originalAmount = parseValue(valStr);
      if (originalAmount !== null && desc.trim().length > 2 && !isNoiseLine(desc)) {
        txns.push({
          date: null,
          description: desc.trim(),
          amount: -Math.abs(originalAmount),
          original_amount: Math.abs(originalAmount),
          row_index: idx++,
        });
      }
      continue;
    }

    // Simple pattern (last resort for CC)
    const simpleMatch = line.match(simpleRe);
    if (simpleMatch) {
      const [, desc, valStr] = simpleMatch;
      const originalAmount = parseValue(valStr);
      if (originalAmount !== null && desc.trim().length > 2 && !isNoiseLine(desc)) {
        txns.push({
          date: null,
          description: desc.trim(),
          amount: -Math.abs(originalAmount),
          original_amount: Math.abs(originalAmount),
          row_index: idx++,
        });
      }
    }
  }

  return txns;
}

// ── PDF text extraction (Deno-compatible) ───────────────────────
async function extractTextFromPdf(pdfBuffer: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const pdf = await getDocumentProxy(pdfBuffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return text || "";
  } catch (e) {
    console.error("unpdf failed:", e);
    return "";
  }
}

// ── OCR via Lovable AI (Gemini multimodal) ──────────────────────
async function ocrWithAI(pdfBuffer: Uint8Array): Promise<{ transactions: ParsedTransaction[]; detectedType: DocType }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not available for OCR");
    return { transactions: [], detectedType: "unknown" };
  }

  const base64Pdf = uint8ToBase64(pdfBuffer);

  const prompt = `Você é um assistente especializado em extrair transações financeiras de extratos bancários e faturas de cartão de crédito em PDF.

Analise este documento PDF e extraia TODAS as transações financeiras encontradas.

Para cada transação, retorne:
- date: a data no formato DD/MM/YYYY (ou null se não houver data visível)
- description: a descrição da transação
- amount: o valor numérico (positivo para créditos/entradas, negativo para débitos/saídas)

Também classifique o tipo do documento:
- "bank" para extrato bancário
- "credit_card" para fatura de cartão de crédito

IMPORTANTE: Para faturas de cartão, INVERTA os sinais (compras devem ser negativas, pagamentos positivos).

Responda APENAS com JSON válido no formato:
{
  "type": "bank" | "credit_card",
  "transactions": [
    { "date": "DD/MM/YYYY", "description": "texto", "amount": 123.45 }
  ]
}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      console.error("AI OCR request failed:", resp.status, await resp.text());
      return { transactions: [], detectedType: "unknown" };
    }

    const aiResult = await resp.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = (jsonMatch[1] || content).trim();

    const parsed = JSON.parse(jsonStr);
    const detectedType: DocType = parsed.type === "credit_card" ? "credit_card" : parsed.type === "bank" ? "bank" : "unknown";

    const transactions: ParsedTransaction[] = (parsed.transactions || []).map((t: any, i: number) => ({
      date: t.date || null,
      description: String(t.description || "").trim(),
      amount: typeof t.amount === "number" ? Math.round(t.amount * 100) / 100 : 0,
      original_amount: typeof t.amount === "number" ? Math.round(Math.abs(t.amount) * 100) / 100 : 0,
      row_index: i,
    })).filter((t: ParsedTransaction) => t.description.length > 1);

    return { transactions, detectedType };
  } catch (e) {
    console.error("AI OCR parsing failed:", e);
    return { transactions: [], detectedType: "unknown" };
  }
}

// ── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return jsonResponse({ error: "Apenas arquivos PDF são aceitos" }, 400);
    }

    await supabase
      .from("pdf_statement_uploads")
      .update({ status: "processing" })
      .eq("id", uploadId)
      .eq("user_id", user.id);

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Try text extraction first
    let text = "";
    try {
      text = await extractTextFromPdf(buffer);
      console.log(`Extracted text length: ${text.length}`);
    } catch (e) {
      console.error("Text extraction failed:", e);
    }

    const cleanText = text.replace(/\s+/g, " ").trim();
    const useOcr = cleanText.length < 100;

    let transactions: ParsedTransaction[];
    let detectedType: DocType;

    if (useOcr) {
      console.log(`Text too short (${cleanText.length} chars), using AI OCR...`);
      const ocrResult = await ocrWithAI(buffer);
      transactions = ocrResult.transactions;
      detectedType = manualType === "bank" || manualType === "credit_card" ? manualType : ocrResult.detectedType;
    } else {
      // Standard regex path
      detectedType = classifyDocument(text);
      if (manualType === "bank" || manualType === "credit_card") {
        detectedType = manualType;
      }
      console.log(`Classified as: ${detectedType}`);

      if (detectedType === "credit_card") {
        transactions = parseCreditCardStatement(text);
      } else if (detectedType === "bank") {
        transactions = parseBankStatement(text);
      } else {
        // Unknown: try both
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

      // Fallback to OCR if regex found 0 transactions
      if (transactions.length === 0) {
        console.log("Regex found 0 transactions, trying AI OCR as fallback...");
        const ocrResult = await ocrWithAI(buffer);
        transactions = ocrResult.transactions;
        if (ocrResult.detectedType !== "unknown") {
          detectedType = ocrResult.detectedType;
        }
      }
    }

    console.log(`Final: ${transactions.length} transactions, type=${detectedType}`);

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

      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from("pdf_parsed_transactions").insert(rows.slice(i, i + 500));
      }
    }

    return jsonResponse({
      detected_type: detectedType,
      transactions,
      ocr_used: useOcr || (transactions.length > 0 && cleanText.length < 100),
      stats: {
        total_lines: text.split("\n").length,
        valid_transactions: transactions.length,
        skipped: text.split("\n").length - transactions.length,
      },
    });
  } catch (err) {
    console.error("parse-pdf-statement error:", err);
    return jsonResponse({ error: "Erro interno no processamento" }, 500);
  }
});
