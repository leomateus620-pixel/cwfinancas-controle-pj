## Problema

A sincronização da planilha `Financeiro SAH 2026.xlsx` falhou com **`CPU Time exceeded`** na Edge Function `sheets-sync-all-tabs` logo após o início:

```
[f29e7bad] File is .xlsx, downloading and parsing...
[f29e7bad] CPU Time exceeded
```

### Causa raiz

A função faz parsing pesado do workbook inteiro de uma só vez:

1. `XLSX.read(buffer, { type: "array" })` — carrega **TODAS** as abas com fórmulas, estilos, datas, etc.
2. Em seguida, `xlsxSheetToRows()` chama `XLSX.utils.sheet_to_json()` para **cada aba** (incluindo abas que nem serão importadas) só para descobrir o `rowCount` no passo de listagem.
3. Para uma planilha com 20+ abas mensais densas, isso estoura o budget de CPU do Deno antes de processar qualquer linha.

A função `google-read-sheet-preview` já foi otimizada com a mesma técnica (two-pass + sheetRows). O sync precisa do mesmo tratamento, **mas mantendo a capacidade de ler todas as linhas das abas selecionadas**.

## Solução

**Arquivo:** `supabase/functions/sheets-sync-all-tabs/index.ts`

### 1. Parsing leve do workbook (passo 1 — apenas metadados)

Substituir `downloadXlsxWorkbook` por duas funções:

- `downloadXlsxBuffer(accessToken, fileId)` — baixa apenas o `ArrayBuffer` do Drive (sem parsear).
- `readXlsxSheetNames(buffer)` — `XLSX.read(buffer, { type: "array", bookSheets: true })` retorna só os nomes das abas. Custo de CPU mínimo.

### 2. Parsing sob demanda por aba (passo 2 — somente quando necessário)

Refatorar `getCachedXlsxRows(sheetName)` para parsear **uma aba por vez**, somente quando ela for de fato lida:

```ts
function readXlsxSheet(buffer, sheetName): string[][] {
  const wb = XLSX.read(buffer, {
    type: "array",
    sheets: [sheetName],
    cellFormula: false,
    cellStyles: false,
    cellHTML: false,
    cellDates: false,
    bookDeps: false,
    bookFiles: false,
    bookProps: false,
    bookVBA: false,
  });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as string[][];
}
```

Cache continua existindo (`xlsxRowCache`) para evitar reparser em chamadas repetidas (ex: APR + bank balance da mesma aba).

### 3. Listagem de abas sem leitura completa

Na seção `if (xlsxWorkbook) { ... allSheets = xlsxWorkbook.SheetNames.map(...) }` (linha ~2108), **não** chamar `getCachedXlsxRows(name)` para descobrir `rowCount`. Em vez disso, usar um `rowCount` padrão alto (ex: 10000), igual ao fallback usado no Google Sheets quando `gridProperties` não vem. O `sheet_to_json` posterior naturalmente retorna o número real de linhas quando a aba for lida.

### 4. Substituir referências a `xlsxWorkbook` 

A variável `xlsxWorkbook: any` passa a ser `xlsxBuffer: Uint8Array | null`. Todos os `if (xlsxWorkbook)` viram `if (xlsxBuffer)` e `getCachedXlsxRows(name)` passa a usar `xlsxBuffer` internamente.

### 5. Resiliência

- `try/catch` em `readXlsxSheet`: se uma aba específica falhar no parse, logar warning e retornar `[]` (a aba é pulada, mas o sync continua).
- Manter o timeout interno (`INTERNAL_TIMEOUT_MS`) já existente — a otimização libera CPU para que ele raramente seja atingido.

### Resultado esperado

- Workbooks grandes (>5 MB, 20+ abas) sincronizam sem `CPU Time exceeded`.
- Apenas as abas selecionadas pelo usuário são parseadas (não todas).
- Comportamento idêntico para usuários (mesmas abas mensais + APR + bank balances).
- Arquivos Google Sheets nativos não são afetados (caminho `xlsxBuffer === null`).

| Ação | Arquivo |
|------|---------|
| Editar `downloadXlsxWorkbook` → `downloadXlsxBuffer` + `readXlsxSheetNames` + `readXlsxSheet` | `supabase/functions/sheets-sync-all-tabs/index.ts` |
| Refatorar uso de `xlsxWorkbook` → `xlsxBuffer` | `supabase/functions/sheets-sync-all-tabs/index.ts` |
| Remover leitura ansiosa de todas as abas no passo `listTabs` | `supabase/functions/sheets-sync-all-tabs/index.ts` |
| Deploy automático da função | (automático) |
