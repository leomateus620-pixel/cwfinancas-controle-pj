## Problema

Após a refatoração para "lazy parsing" (uma aba por vez), a sincronização de planilhas `.xlsx` ficou **muito lenta**. Os logs mostram ~2 segundos por aba só na fase de leitura de saldos. Para 20 abas, são 40+ segundos apenas re-descompactando o ZIP do `.xlsx`.

### Causa raiz

A função `readXlsxSheet(buffer, sheetName)` chama `XLSX.read(buffer, { sheets: [name] })` para CADA aba. O XLSX é um arquivo ZIP — mesmo passando `sheets: [name]`, a biblioteca **descompacta o container inteiro** a cada chamada. O cache de linhas (`xlsxRowCache`) ajuda quando a mesma aba é lida 2x, mas não evita o trabalho repetido entre abas diferentes.

A versão "lazy" foi criada para resolver o erro de CPU exceeded em workbooks gigantes, mas penaliza o caso comum (workbooks pequenos/médios com muitas abas).

## Solução: Parse único + corte por aba

Voltar a fazer **um único `XLSX.read` do workbook completo** (rápido) e extrair as linhas de cada aba a partir do objeto já parseado em memória, **mantendo as flags de stripping** que evitam o estouro de CPU (sem fórmulas, sem styles, sem datas, sem props).

Para workbooks realmente gigantes, adicionar um **fallback automático**: se o parse completo falhar (timeout/CPU), cair para o modo lazy aba-por-aba que já existe.

### Mudanças em `supabase/functions/sheets-sync-all-tabs/index.ts`

1. **Nova função `readXlsxWorkbookFull(buffer)`** — parseia uma única vez o workbook inteiro com flags leves (`cellFormula:false`, `cellStyles:false`, `cellDates:false`, `bookProps:false`, `bookFiles:false`, `bookVBA:false`). Retorna `{ sheetNames, sheets: Record<string, string[][]> }` já com todas as abas convertidas para arrays.

2. **Refatorar bloco de download/leitura (linhas ~2117-2153)**:
   - Após `downloadXlsxBuffer`, tentar `readXlsxWorkbookFull(buffer)` dentro de um `try/catch`.
   - Se sucesso: popular `xlsxRowCache` com TODAS as abas de uma vez (zero re-parse depois) e usar `sheetNames` para `xlsxSheetNames`.
   - Se falhar (workbook gigante / CPU exceeded): cair para o caminho atual (`readXlsxSheetNames` + `getCachedXlsxRows` lazy aba por aba), logando `[xlsx] full parse failed, falling back to lazy mode`.

3. **`getCachedXlsxRows` permanece** como está. No caminho rápido ele só faz lookup no Map (já populado). No fallback, mantém o comportamento atual de parse sob demanda.

4. **Manter o release do buffer** após processamento para liberar memória (`xlsxBuffer = null` ao fim, antes da fase de upsert pesada).

5. **Logging adicional** para medir: tempo de download, tempo de parse completo, número de abas, bytes do buffer. Facilita diagnóstico futuro.

### Resultado esperado

- Workbooks pequenos/médios (caso comum): 1 parse só → sincronização **5-10x mais rápida** que o estado atual.
- Workbooks gigantes que estouravam CPU: continuam funcionando via fallback lazy (sem regressão).
- Sem mudanças no contrato da função, no schema do banco, ou nos hooks do front-end.

### Validação

Após o deploy:
- Reabrir o modal e sincronizar a planilha "Financeiro SAH 2026.xlsx" (a do screenshot).
- Confirmar pelos logs do Edge Function que o parse completo é usado (linha `[xlsx] full parse OK in Xms`).
- Confirmar que a barra de progresso avança rapidamente entre abas, sem o delay de ~2s por aba.

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/sheets-sync-all-tabs/index.ts` |
| Deploy | `sheets-sync-all-tabs` |
