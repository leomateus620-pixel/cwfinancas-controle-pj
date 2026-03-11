

## Plano: Corrigir parser APR para planilha "Financeiro GR - 2026.xlsx"

### Diagnóstico

Analisei os dados importados no banco e o código do parser `parseAPRHorizontal`. Encontrei 5 inconsistências:

**1. Status nunca extraído (339 registros com `status_raw: null`)**
- A planilha "Contas a Pagar" usa layout: `[Vcto, Despesa, Obs, Valor_Jan, Status_Jan, Valor_Fev, Status_Fev, ...]` — 2 colunas por mês (valor + status)
- O parser detecta sub-headers corretamente (`hasSubHeaders=true`), mas a coluna de status no sub-header NÃO contém as keywords esperadas ("pgto", "status", "situacao"), então o valor "ok"/"OK" nunca é capturado
- O fallback (célula adjacente ao valor) só roda quando `!hasSubHeaders`, criando um dead path

**2. Due date nunca extraída**
- col_0 contém o dia do mês como número simples ("1", "5", "15"), não no formato "Dia XX"
- O parser só reconhece o padrão `Dia\s+(\d{1,2})` — um número simples é ignorado

**3. Receivable importa a linha de header como dado**
- Row 2 com "CLIENTE" no col_0 é importada como registro com amount=30729 (que é o total do mês, não um valor individual)
- `isAPRSkippableRow` não detecta headers APR horizontais

**4. Notes/Obs não mapeado para payable**
- col_2 contém observações ("pode ser variável-sempre conferir FP", "pix - fixo") mas não é extraído porque `leftColMap` não detecta "obs" na posição correta

**5. Receivable sem forma de pagamento**
- col_1 tem "Boleto" mas `leftColMap` não está mapeando corretamente

### Solução

Modificar `parseAPRHorizontal` em `sheets-sync-all-tabs/index.ts` com as seguintes correções:

**A. Status extraction — fallback universal**
Quando o sub-header de uma célula do grupo não match nenhum keyword E o amount já foi encontrado, tratar texto não-numérico como status candidato. Remover a condição `!hasSubHeaders` do fallback de status adjacente.

**B. Due date — aceitar número simples como dia**
Além de `Dia XX`, reconhecer valores numéricos puros (1-31) no `vctoIdx` como dia do mês.

**C. Header row detection para receivable**
Adicionar detecção de "CLIENTE", "FORNECEDOR" e outros termos de cabeçalho em `isAPRSkippableRow` para layout horizontal. Verificar se a primeira célula é um header keyword APR.

**D. Left column mapping melhorado**
Expandir keywords de detecção para incluir "obs" standalone e melhorar o positional heuristic para 3 colunas fixas (payable) e 2 colunas fixas (receivable).

**E. Status "pago" no payable para "ok"**
Adicionar "ok" ao `STATUS_MAP_PAYABLE` mapeando para "pago", já que a planilha usa "ok"/"OK" para marcar pagamentos realizados.

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Corrigir 5 pontos do parser APR horizontal: status extraction, due date parsing, header skip, left column mapping, status normalization |

### Detalhes técnicos

```text
Payable raw layout (from DB raw_data):
col_0=day  col_1=description  col_2=obs  col_3=jan_val  col_4=jan_status  col_5=feb_val  col_6=feb_status ...

Receivable raw layout:
col_0=client  col_1=payment_method  col_2=jan_val  col_3=feb_val  col_4=mar_val ...

Fixes:
1. STATUS: Remove `!hasSubHeaders` gate → always try adjacent cell as status
2. DATE: parseInt(vctoRaw) → if 1-31, use as day number  
3. SKIP: Add "cliente","fornecedor" to APR skippable header detection
4. LEFTCOL: Better heuristic scanning for obs/forma columns
5. STATUS_MAP: Add "ok" → "pago" (payable) / "recebido" (receivable)
```

