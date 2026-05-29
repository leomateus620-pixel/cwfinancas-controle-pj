import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SHEETS_MIME = "application/vnd.google-apps.spreadsheet";

async function refreshAccessToken(
  supabase: any,
  userId: string,
  refreshToken: string,
  requestId: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) {
      console.error(`[${requestId}] Token refresh failed:`, await response.text());
      return null;
    }
    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    const updateData: any = {
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };
    if (data.refresh_token) updateData.refresh_token = data.refresh_token;
    await supabase.from("google_oauth_tokens").update(updateData).eq("user_id", userId);
    return { access_token: data.access_token, expires_at: expiresAt };
  } catch (error) {
    console.error(`[${requestId}] Error refreshing token:`, error);
    return null;
  }
}

async function getFileMimeType(accessToken: string, fileId: string): Promise<{ mimeType: string; name: string }> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Drive API error: ${response.status} - ${await response.text()}`);
  return response.json();
}

async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Sheets API error: ${response.status} - ${await response.text()}`);
  return response.json();
}

async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    console.error(`Failed to get values for range ${range}:`, await response.text());
    return [];
  }
  const data = await response.json();
  return data.values || [];
}

async function handleNativeSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string | undefined,
  sheetNames: string[] | undefined,
  mode: "preview" | "full"
) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const spreadsheetName = metadata.properties?.title || "Sem nome";
  const sheets = (metadata.sheets || []).map((sheet: any) => ({
    sheet_id: sheet.properties.sheetId,
    title: sheet.properties.title,
    index: sheet.properties.index,
  }));

  const targetSheet = sheetName || sheets[0]?.title || "Sheet1";
  const previewRange = `'${targetSheet}'!A1:Z20`;
  let previewValues = await getSheetValues(accessToken, spreadsheetId, previewRange);
  let usedRange = previewRange;
  if (previewValues.length === 0 && !sheetName && sheets.length > 0) {
    const fallbackRange = "A1:Z20";
    previewValues = await getSheetValues(accessToken, spreadsheetId, fallbackRange);
    usedRange = fallbackRange;
  }

  let workbookSheets: { name: string; rows: string[][] }[] | undefined;
  if (sheetNames && sheetNames.length > 0) {
    workbookSheets = [];
    const rowCap = mode === "full" ? 5000 : 50;
    const colRange = mode === "full" ? "ZZ" : "Z";
    for (const name of sheetNames) {
      const range = `'${name}'!A1:${colRange}${rowCap}`;
      const rows = await getSheetValues(accessToken, spreadsheetId, range);
      workbookSheets.push({ name, rows });
    }
  }

  return { spreadsheetName, sheets, previewValues, usedRange, workbookSheets };
}

async function handleXlsxFile(
  accessToken: string,
  fileId: string,
  fileName: string,
  sheetName: string | undefined,
  sheetNames: string[] | undefined,
  mode: "preview" | "full"
) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Drive download error: ${response.status} - ${await response.text()}`);

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let allSheetNames: string[] = [];
  try {
    const wbMeta = XLSX.read(data, { type: "array", bookSheets: true });
    allSheetNames = wbMeta.SheetNames || [];
  } catch (err) {
    console.error("[handleXlsxFile] bookSheets failed:", (err as Error)?.message);
    throw new Error(`Falha ao ler estrutura do arquivo .xlsx: ${(err as Error)?.message ?? "erro desconhecido"}`);
  }

  const sheets = allSheetNames.map((name, index) => ({ sheet_id: index, title: name, index }));
  const targetSheet = sheetName || allSheetNames[0] || "";

  // preview values of the target sheet (always)
  let previewValues: string[][] = [];
  if (targetSheet) {
    try {
      const wb = XLSX.read(data, {
        type: "array",
        sheets: [targetSheet],
        sheetRows: 20,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        cellDates: false,
        cellNF: false,
        bookDeps: false,
        bookFiles: false,
        bookProps: false,
        bookVBA: false,
      } as any);
      const ws = wb.Sheets[targetSheet];
      if (ws && ws["!ref"]) {
        try {
          const decoded = XLSX.utils.decode_range(ws["!ref"]);
          decoded.s.r = 0;
          decoded.s.c = 0;
          decoded.e.r = Math.min(decoded.e.r, 19);
          decoded.e.c = Math.min(decoded.e.c, 25);
          ws["!ref"] = XLSX.utils.encode_range(decoded);
        } catch { /* keep */ }
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        previewValues = json.slice(0, 20).map((row) =>
          (row || []).slice(0, 26).map((cell: any) => (cell != null ? String(cell) : ""))
        );
      }
    } catch (err) {
      console.error(`[handleXlsxFile] preview "${targetSheet}" failed:`, (err as Error)?.message);
      previewValues = [];
    }
  }

  // workbook with requested sheetNames
  let workbookSheets: { name: string; rows: string[][] }[] | undefined;
  if (sheetNames && sheetNames.length > 0) {
    workbookSheets = [];
    const rowCap = mode === "full" ? 5000 : 50;
    try {
      const wb = XLSX.read(data, {
        type: "array",
        sheets: sheetNames,
        sheetRows: rowCap,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        cellDates: false,
        cellNF: false,
        bookDeps: false,
        bookFiles: false,
        bookProps: false,
        bookVBA: false,
      } as any);
      for (const name of sheetNames) {
        const ws = wb.Sheets[name];
        if (!ws) {
          workbookSheets.push({ name, rows: [] });
          continue;
        }
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        const rows = json.slice(0, rowCap).map((row) =>
          (row || []).map((cell: any) => (cell != null ? String(cell) : ""))
        );
        workbookSheets.push({ name, rows });
      }
    } catch (err) {
      console.error(`[handleXlsxFile] workbook read failed:`, (err as Error)?.message);
    }
  }

  return {
    spreadsheetName: fileName || "Sem nome",
    sheets,
    previewValues,
    usedRange: targetSheet ? `'${targetSheet}'!A1:Z20` : "",
    workbookSheets,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ code: "UNAUTHORIZED", message: "Token de autenticação não fornecido", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ code: "UNAUTHORIZED", message: "Usuário não autenticado", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const spreadsheetId: string | undefined = body.spreadsheetId;
    const sheetName: string | undefined = body.sheetName;
    const sheetNames: string[] | undefined = Array.isArray(body.sheetNames) ? body.sheetNames : undefined;
    const mode: "preview" | "full" = body.mode === "full" ? "full" : "preview";

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ code: "INVALID_REQUEST", message: "spreadsheetId é obrigatório", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ code: "NOT_CONNECTED", message: "Conecte sua conta Google primeiro", needs_auth: true, request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
      const refreshResult = await refreshAccessToken(supabase, userId, refreshToken, requestId);
      if (!refreshResult) {
        return new Response(
          JSON.stringify({ code: "REAUTH_REQUIRED", message: "Sua sessão do Google expirou. Por favor, reconecte sua conta.", needs_auth: true, request_id: requestId }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshResult.access_token;
    }

    const fileInfo = await getFileMimeType(accessToken, spreadsheetId);
    console.log(`[${requestId}] File "${fileInfo.name}" mimeType: ${fileInfo.mimeType} mode=${mode}`);

    const isXlsx = fileInfo.mimeType === XLSX_MIME;
    const isNative = fileInfo.mimeType === SHEETS_MIME;

    if (!isXlsx && !isNative) {
      return new Response(
        JSON.stringify({
          code: "UNSUPPORTED_MIME",
          message: `Tipo de arquivo não suportado (${fileInfo.mimeType}). Use Google Sheets ou Excel (.xlsx).`,
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = isXlsx ? "drive_xlsx" : "google_sheets";
    const result = isXlsx
      ? await handleXlsxFile(accessToken, spreadsheetId, fileInfo.name, sheetName, sheetNames, mode)
      : await handleNativeSheet(accessToken, spreadsheetId, sheetName, sheetNames, mode);

    const payload: Record<string, unknown> = {
      spreadsheet: { id: spreadsheetId, name: result.spreadsheetName, mimeType: fileInfo.mimeType, provider },
      sheets: result.sheets,
      preview: {
        range: result.usedRange,
        values: result.previewValues,
        row_count: result.previewValues.length,
      },
      request_id: requestId,
    };
    if (result.workbookSheets) {
      payload.workbook = {
        sourceName: result.spreadsheetName,
        provider,
        sheets: result.workbookSheets,
      };
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error reading sheet preview:`, error);
    return new Response(
      JSON.stringify({
        code: "GOOGLE_API_ERROR",
        message: "Falha ao ler dados da planilha",
        details: error?.message ?? String(error),
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
