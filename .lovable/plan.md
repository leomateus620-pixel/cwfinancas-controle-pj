## Diagnóstico

Quando o usuário seleciona o arquivo `Financeiro SAH 2026.xlsx`, o modal exibe apenas "Todas as Abas" (sem listar as abas mensais) e cai em erro `Edge Function returned a non-2xx status code`.

### Causa raiz

A função `google-read-sheet-preview` está estourando CPU do Edge Runtime (`CPU Time exceeded`) ao processar arquivos `.xlsx` grandes, conforme logs:

```
Successfully fetched preview for 1z2drMK6wMorPy3-kiSD8Aa5lSUJn3ZD0
CPU Time exceeded   ← 10ms depois
```

O ponto crítico está em `handleXlsxFile`:

```ts
const workbook = XLSX.read(data, { type: "array" });           // parseia TUDO
// ... depois ...
const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }); // converte planilha INTEIRA
previewValues = jsonRows.slice(0, 20)...                       // só usa 20 linhas
```

O arquivo da SAH tem ~14 abas mensais densas + DRE + APR. Ler o workbook completo (com fórmulas, estilos, todas as células) e converter a aba inteira para JSON apenas para fatiar 20 linhas estoura o limite de CPU do edge worker. Por isso a função até loga "Success" mas o runtime mata o processo antes de devolver o JSON ao cliente — gerando o `non-2xx` no front.

## Solução

Otimizar `handleXlsxFile` em `supabase/functions/google-read-sheet-preview/index.ts` para fazer parsing mínimo:

1. **Primeira leitura — só nomes de abas:**
   ```ts
   const wbMeta = XLSX.read(data, { type: "array", bookSheets: true });
   const sheetNames = wbMeta.SheetNames;
   ```
   Isso evita parsear conteúdo de qualquer aba.

2. **Segunda leitura — só a aba alvo, só 20 linhas:**
   ```ts
   const wb = XLSX.read(data, {
     type: "array",
     sheets: [targetSheet],
     sheetRows: 20,        // limita parsing a 20 linhas
     cellFormula: false,
     cellHTML: false,
     cellStyles: false,
     cellDates: false,
     cellNF: false,
   });
   const worksheet = wb.Sheets[targetSheet];
   ```

3. **Conversão direta para matriz** com `range` limitado às primeiras 20 linhas e 26 colunas (A:Z), sem percorrer a aba inteira:
   ```ts
   const ref = worksheet['!ref'];
   const decoded = XLSX.utils.decode_range(ref);
   decoded.e.r = Math.min(decoded.e.r, 19);
   decoded.e.c = Math.min(decoded.e.c, 25);
   const limitedRef = XLSX.utils.encode_range(decoded);
   const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
     header: 1, defval: "", range: limitedRef, blankrows: false,
   });
   ```

4. **Fallback resiliente:** se a segunda leitura falhar (aba inexistente, nome com aspas etc.), retornar `previewValues: []` em vez de quebrar — o usuário ainda consegue ver a lista de abas e clicar em "Todas as Abas".

5. **Try/catch granular** em torno do parsing XLSX para devolver erro estruturado (`code: "XLSX_PARSE_ERROR"`) com mensagem amigável em vez de 500 genérico.

### Resultado esperado

- Modal "Selecionar Aba" passa a listar todas as abas reais do `.xlsx` (DRE, Janeiro, Fevereiro, …, APR) além do botão "Todas as Abas".
- Função responde em <2s mesmo para workbooks grandes.
- Sem `CPU Time exceeded`.
- Erro de parse, se ocorrer, vira mensagem clara em vez de "non-2xx".

## Detalhes técnicos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/google-read-sheet-preview/index.ts` (apenas `handleXlsxFile` + try/catch no handler) |

Sem alterações no front-end, no banco ou em outras funções. A interface `{ spreadsheet, sheets, preview }` permanece idêntica.