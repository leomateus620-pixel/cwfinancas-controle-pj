import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
  "pix - recebido", "pix - enviado", "pix - agendamento",
  "aplicacao automatica", "aplicação automática", "resgate automatico",
  "resgate automático", "banrisul", "banco do brasil", "bradesco",
  "itau", "itaú", "caixa economica", "vero deb", "vero ant",
  "pagamento titulo", "pagamento título", "cheque compensado",
  "transferência enviada", "transferencia enviada",
  "pagamento de boleto", "tarifa modulo", "tarifa pacote",
  "lançamentos", "lancamentos",
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
  /^saldo\s*(anterior|final|do\s*dia|disponível|disponivel|ant\s+em)/i,
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
  /^banricompras\s+a\s+prazo\s+em/i,
  /cdb\s*automatico/i,
  /tarifa\s*economica/i,
  /^\s*NOME:\s*$/i,
  /^s\s*a\s*l\s*d\s*o$/i,
];

function isNoiseLine(line: string): boolean {
  for (const pat of NOISE_PATTERNS) {
    if (pat.test(line.trim())) return true;
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

  // Handle BB-style (+) / (-) markers
  if (/\(\+\)$/.test(cleaned)) {
    sign = 1;
    cleaned = cleaned.replace(/\(\+\)$/, "");
  } else if (/\(-\)$/.test(cleaned)) {
    sign = -1;
    cleaned = cleaned.replace(/\(-\)$/, "");
  }
  // Handle trailing C/D (credit/debit markers)
  else if (/[Cc]$/.test(cleaned)) {
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

  // Remove any remaining whitespace
  cleaned = cleaned.trim();

  // Brazilian format: 1.234,56 → 1234.56
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * sign * 100) / 100;
}

// ── Month abbreviation map (PT-BR) ─────────────────────────────
const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

/** Extract month/year context from header lines like "MOVIMENTOS ABR/2026" or "SALDO ANT EM 02/04/2026" */
function extractHeaderMonthYear(text: string): { month: string; year: string } | null {
  // Pattern: MOVIMENTOS ABR/2026
  const movMatch = text.match(/MOVIMENTOS\s+([A-Z]{3})\/(\d{4})/i);
  if (movMatch) {
    const m = MONTH_MAP[movMatch[1].toUpperCase()];
    if (m) return { month: m, year: movMatch[2] };
  }

  // Pattern: SALDO ANT EM DD/MM/YYYY
  const saldoMatch = text.match(/SALDO\s+ANT(?:ERIOR)?\s+EM\s+\d{2}\/(\d{2})\/(\d{4})/i);
  if (saldoMatch) return { month: saldoMatch[1], year: saldoMatch[2] };

  // Pattern: any DD/MM/YYYY in the first 500 chars (header area)
  const header = text.substring(0, 500);
  const dateMatch = header.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) return { month: dateMatch[2], year: dateMatch[3] };

  return null;
}

/** Try to extract month/year from filename like Extrato_20260414.pdf */
function extractMonthYearFromFilename(filename: string | null): { month: string; year: string } | null {
  if (!filename) return null;
  const m = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return { month: m[2], year: m[1] };
  return null;
}

// ── Bank statement parser ───────────────────────────────────────
function parseBankStatement(text: string, filename?: string | null): ParsedTransaction[] {
  const lines = text.split("\n");
  const txns: ParsedTransaction[] = [];
  let idx = 0;
  let currentDay: string | null = null;

  // Extract month/year context from headers
  const headerCtx = extractHeaderMonthYear(text) || extractMonthYearFromFilename(filename ?? null);

  // Pattern 1: DD/MM/YYYY desc valor (generic)
  const fullDateRe = /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?\s*[\d.,]+(?:\s*[CDcd]|\s*\(\+\)|\s*\(-\))?)$/;

  // Pattern BB: DD/MM/YYYY ... valor (+/-) — Banco do Brasil
  const bbRe = /^(\d{2}\/\d{2}\/\d{4})\s+\d+\s+\d+\s+(.+?)\s+([\d.,]+)\s*\(([+-])\)$/;

  // Pattern BB variant: DD/MM/YYYY lote desc valor (+/-)
  const bbNoDocRe = /^(\d{2}\/\d{2}\/\d{4})\s+\d+\s+(.+?)\s+([\d.,]+)\s*\(([+-])\)$/;

  // Pattern Banrisul: DD HISTORICO DOCUMENTO VALOR
  const banrisulRe = /^(\d{2})?\s*(.+?)\s+(\d{3,})\s+([\d.,]+[-]?)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || isNoiseLine(line)) continue;

    // Skip "Saldo do dia", "Saldo Anterior", "S A L D O" lines
    if (/saldo\s*(do\s*dia|anterior|final)/i.test(line)) continue;
    if (/s\s+a\s+l\s+d\s+o/i.test(line)) continue;
    if (/^00\/00\/0000/.test(line)) continue;

    // Helper: peek next non-empty line for NOME: and consume it
    const peekNome = (): string | null => {
      for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
        const next = lines[j].trim();
        if (!next) continue;
        const nomeMatch = next.match(/^\s*NOME:\s*(.+)/i);
        if (nomeMatch) {
          i = j; // consume the line
          return nomeMatch[1].trim();
        }
        break; // non-empty, non-NOME line → stop
      }
      return null;
    };

    // Try BB pattern first (most specific)
    const bbMatch = line.match(bbRe);
    if (bbMatch) {
      const [, dateStr, desc, valStr, signChar] = bbMatch;
      const cleanDesc = desc.replace(/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+.*$/, "").trim();
      let finalDesc = cleanDesc || desc.trim();
      if (isNoiseLine(finalDesc)) continue;
      const num = parseValue(valStr);
      if (num !== null && finalDesc.length > 1) {
        const sign = signChar === "+" ? 1 : -1;
        const amount = Math.abs(num) * sign;
        const nome = peekNome();
        if (nome) finalDesc += ` - ${nome}`;
        txns.push({ date: dateStr, description: finalDesc, amount, original_amount: Math.abs(num), row_index: idx++ });
      }
      continue;
    }

    // Try BB no-doc pattern
    const bbNoDocMatch = line.match(bbNoDocRe);
    if (bbNoDocMatch) {
      const [, dateStr, desc, valStr, signChar] = bbNoDocMatch;
      const cleanDesc = desc.replace(/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+.*$/, "").trim();
      let finalDesc = cleanDesc || desc.trim();
      if (isNoiseLine(finalDesc)) continue;
      const num = parseValue(valStr);
      if (num !== null && finalDesc.length > 1) {
        const sign = signChar === "+" ? 1 : -1;
        const amount = Math.abs(num) * sign;
        const nome = peekNome();
        if (nome) finalDesc += ` - ${nome}`;
        txns.push({ date: dateStr, description: finalDesc, amount, original_amount: Math.abs(num), row_index: idx++ });
      }
      continue;
    }

    // Try full date pattern with (+)/(-) or C/D
    const fullMatch = line.match(fullDateRe);
    if (fullMatch) {
      const [, dateStr, desc, valStr] = fullMatch;
      const amount = parseValue(valStr);
      if (amount !== null && desc.trim().length > 1 && !isNoiseLine(desc)) {
        let finalDesc = desc.trim();
        const nome = peekNome();
        if (nome) finalDesc += ` - ${nome}`;
        txns.push({ date: dateStr, description: finalDesc, amount, original_amount: Math.abs(amount), row_index: idx++ });
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
      const dayStr = banriMatch[1] || currentDay;
      let desc = banriMatch[2].trim();
      const valStr = banriMatch[4];
      const amount = parseValue(valStr);

      if (amount !== null && desc.length > 2 && !isNoiseLine(desc)) {
        // Peek for NOME: line
        const nome = peekNome();
        if (nome) desc += ` - ${nome}`;

        // Compose full date using header context
        let fullDate: string | null = null;
        if (dayStr && headerCtx) {
          fullDate = `${dayStr}/${headerCtx.month}/${headerCtx.year}`;
        } else if (dayStr) {
          fullDate = dayStr; // fallback: day only
        }

        txns.push({
          date: fullDate,
          description: desc,
          amount,
          original_amount: Math.abs(amount),
          row_index: idx++,
        });
      }
    }
  }

  // Post-process: fix any remaining incomplete dates (1-2 digit day only)
  if (headerCtx) {
    for (const t of txns) {
      if (t.date && /^\d{1,2}$/.test(t.date)) {
        t.date = `${t.date.padStart(2, "0")}/${headerCtx.month}/${headerCtx.year}`;
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

  const nubankRe = /^(\d{2}\s+\w{3})\s+\.\.\.\.\s*\d{4}\s+(.+?)\s+R\$\s*([\d.,]+)$/;
  const genericRe = /^(?:\d{2}\/\d{2}(?:\/\d{2,4})?\s+)?(.+?)\s+R\$\s*([\d.,]+)$/;
  const simpleRe = /^(.+?)\s+(-?\s*[\d.,]+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isNoiseLine(line)) continue;

    if (/pagamento\s+(em|recebido)/i.test(line)) continue;
    if (/saldo\s+restante/i.test(line)) continue;
    if (/fatura\s+anterior/i.test(line)) continue;

    const nubankMatch = line.match(nubankRe);
    if (nubankMatch) {
      const [, dateStr, desc, valStr] = nubankMatch;
      const originalAmount = parseValue(valStr);
      if (originalAmount !== null && desc.trim().length > 2) {
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
async function ocrWithAI(pdfBuffer: Uint8Array, attempt = 1): Promise<{ transactions: ParsedTransaction[]; detectedType: DocType }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not available for OCR");
    return { transactions: [], detectedType: "unknown" };
  }

  const base64Pdf = uint8ToBase64(pdfBuffer);

  const prompt = `Extraia TODAS as transações financeiras deste PDF de extrato bancário ou fatura de cartão.

Retorne JSON compacto:
{"type":"bank"|"credit_card","transactions":[{"date":"DD/MM/YYYY","description":"texto","amount":123.45}]}

Regras:
- date: SEMPRE no formato DD/MM/YYYY completo. Se o PDF mostrar apenas o dia (ex: "06", "07") nas linhas de transação, procure o mês e ano no cabeçalho do extrato (ex: "MOVIMENTOS ABR/2026", "SALDO ANT EM 02/04/2026", ou a data de emissão) e componha a data completa.
- amount: positivo=crédito/entrada, negativo=débito/saída
- Para cartão: compras=negativo, pagamentos=positivo
- Ignore linhas de saldo, totais, limites
- Linhas que começam com "NOME:" após uma transação PIX contêm o nome do pagador/recebedor. Inclua esse nome na descrição da transação, separado por " - ". Exemplo: "PIX ENVIADO - MERCADO RAMBO E WEBER LTDA"
- Transações com prefixo VERO (VERO ANT BLF, VERO DEB BLF, VERO CRE BLF, VERO BANRICOMPRAS) são recebimentos via maquininha de cartão POS — devem ter amount POSITIVO (crédito/entrada).
- Apenas transações reais
- Responda SOMENTE com o JSON, sem markdown`;

  const MAX_ATTEMPTS = 2;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "no body");
      console.error(`AI OCR request failed: ${resp.status} - ${errText}`);
      if (attempt < MAX_ATTEMPTS) {
        console.log(`Retrying OCR (attempt ${attempt + 1})...`);
        return ocrWithAI(pdfBuffer, attempt + 1);
      }
      return { transactions: [], detectedType: "unknown" };
    }

    // Use text() + manual JSON.parse for resilience
    const rawBody = await resp.text();
    if (!rawBody || rawBody.length < 10) {
      console.error("AI OCR returned empty/tiny body:", rawBody);
      if (attempt < MAX_ATTEMPTS) {
        console.log(`Retrying OCR (attempt ${attempt + 1})...`);
        return ocrWithAI(pdfBuffer, attempt + 1);
      }
      return { transactions: [], detectedType: "unknown" };
    }

    let aiResult: any;
    try {
      aiResult = JSON.parse(rawBody);
    } catch (jsonErr) {
      console.error("Failed to parse AI response JSON:", jsonErr, "Body length:", rawBody.length, "First 200 chars:", rawBody.substring(0, 200));
      if (attempt < MAX_ATTEMPTS) {
        console.log(`Retrying OCR (attempt ${attempt + 1})...`);
        return ocrWithAI(pdfBuffer, attempt + 1);
      }
      return { transactions: [], detectedType: "unknown" };
    }

    const content = aiResult.choices?.[0]?.message?.content || "";
    if (!content) {
      console.error("AI OCR returned empty content");
      if (attempt < MAX_ATTEMPTS) return ocrWithAI(pdfBuffer, attempt + 1);
      return { transactions: [], detectedType: "unknown" };
    }

    // Extract JSON from possible markdown fences
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = (jsonMatch[1] || content).trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (innerErr) {
      console.error("Failed to parse extracted JSON from AI content:", innerErr, "Content preview:", jsonStr.substring(0, 300));
      if (attempt < MAX_ATTEMPTS) return ocrWithAI(pdfBuffer, attempt + 1);
      return { transactions: [], detectedType: "unknown" };
    }

    const detectedType: DocType = parsed.type === "credit_card" ? "credit_card" : parsed.type === "bank" ? "bank" : "unknown";

    const transactions: ParsedTransaction[] = (parsed.transactions || []).map((t: any, i: number) => ({
      date: t.date || null,
      description: String(t.description || "").trim(),
      amount: typeof t.amount === "number" ? Math.round(t.amount * 100) / 100 : 0,
      original_amount: typeof t.amount === "number" ? Math.round(Math.abs(t.amount) * 100) / 100 : 0,
      row_index: i,
    })).filter((t: ParsedTransaction) => t.description.length > 1);

    console.log(`OCR attempt ${attempt} extracted ${transactions.length} transactions`);
    return { transactions, detectedType };
  } catch (e) {
    console.error(`AI OCR attempt ${attempt} failed:`, e);
    if (attempt < MAX_ATTEMPTS) {
      console.log(`Retrying OCR (attempt ${attempt + 1})...`);
      return ocrWithAI(pdfBuffer, attempt + 1);
    }
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
    // Count actual letters to detect garbled/empty extraction
    const letterCount = (cleanText.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    const useOcr = cleanText.length < 100 || letterCount < 50;

    let transactions: ParsedTransaction[];
    let detectedType: DocType;
    let ocrUsed = false;

    if (useOcr) {
      console.log(`Text too short (${cleanText.length} chars, ${letterCount} letters), using AI OCR...`);
      ocrUsed = true;
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
        transactions = parseBankStatement(text, file.name);
      } else {
        const bankTxns = parseBankStatement(text, file.name);
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
        ocrUsed = true;
        const ocrResult = await ocrWithAI(buffer);
        transactions = ocrResult.transactions;
        if (ocrResult.detectedType !== "unknown") {
          detectedType = ocrResult.detectedType;
        }
      }
    }

    // Post-process OCR results: fix incomplete dates (day-only)
    if (ocrUsed && transactions.length > 0) {
      const ctx = extractHeaderMonthYear(text) || extractMonthYearFromFilename(file?.name ?? null);
      if (ctx) {
        for (const t of transactions) {
          if (t.date && /^\d{1,2}$/.test(t.date.trim())) {
            t.date = `${t.date.trim().padStart(2, "0")}/${ctx.month}/${ctx.year}`;
          }
        }
      }
    }

    // Post-process: VERO (POS/maquininha) transactions are always positive income
    const VERO_POSITIVE_RE = /^VERO\s+(ANT|DEB|CRE|BANRICOMPRAS)/i;
    for (const t of transactions) {
      if (VERO_POSITIVE_RE.test(t.description) && t.amount < 0) {
        t.amount = Math.abs(t.amount);
      }
    }

    console.log(`Final: ${transactions.length} transactions, type=${detectedType}, ocr=${ocrUsed}`);

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
      ocr_used: ocrUsed,
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
