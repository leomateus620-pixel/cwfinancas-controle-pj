
# Plano: Corrigir Definitivamente o Sincronizador de Planilhas

## Diagnóstico do Problema

Analisando o código e os dados, identifiquei a causa raiz dos 172 erros de "Valor inválido ou zero":

### Problemas no Parser Atual (`parseCurrency`)

```typescript
// Parser atual - PROBLEMAS:
function parseCurrency(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;  // PROBLEMA: retorna 0 em vez de null
  
  let cleaned = value.toString().replace(/[R$\s]/g, "").trim();
  // PROBLEMA: não trata "(1.234,56)" como negativo
  // PROBLEMA: não remove caracteres invisíveis
  // PROBLEMA: não trata "R$ - 1.234,56"
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;  // PROBLEMA: retorna 0 em vez de null
}
```

### Problemas de Classificacao

1. Linhas de "TOTAL", "SALDO", "SUBTOTAL" sao tratadas como erro - deviam ser `skipped`
2. Linhas vazias ou de cabecalho repetido contam como `failed`
3. Nao suporta colunas Credito/Debito separadas
4. `Math.abs()` no valor remove informacao de sinal

### Dados Observados

Os dados importados com sucesso mostram o formato:
```
" Valor ": " R$  1.234,56 "  // Espacos no nome e no valor
" Categoria ": "Receita"      // Espacos no nome da coluna
```

---

## Solucao Proposta

### A) Parser de Valores Robusto (`parseBRL`)

Nova funcao que trata TODOS os formatos brasileiros:

```typescript
function parseBRL(value: string | number | null | undefined): number | null {
  // Retorna null para valores vazios (nao 0!)
  if (value === null || value === undefined || value === "") return null;
  
  // Se ja e numero, retorna direto
  if (typeof value === "number") return value;
  
  let str = String(value).trim();
  
  // Remove simbolo de moeda e espacos
  str = str.replace(/[R$¤€£¥\s]/g, "");
  
  // Remove caracteres invisíveis (non-breaking space, etc)
  str = str.replace(/[\u00A0\u2007\u202F]/g, "");
  
  // Se vazio apos limpeza, retorna null
  if (!str || str === "-") return null;
  
  // Detecta negativo por parenteses: (1.234,56) -> -1234.56
  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) {
    str = str.slice(1, -1);
  }
  
  // Detecta negativo por hifen no inicio ou fim
  const isNegativePrefix = str.startsWith("-");
  const isNegativeSuffix = str.endsWith("-");
  str = str.replace(/^-|-$/g, "");
  
  // Determina formato: BR (1.234,56) vs US (1,234.56)
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const isCommaDecimal = lastComma > lastDot;
  
  if (isCommaDecimal) {
    // Formato BR: 1.234.567,89
    str = str.replace(/\./g, "");  // Remove pontos (milhares)
    str = str.replace(",", ".");   // Virgula -> ponto decimal
  } else {
    // Formato US: 1,234,567.89
    str = str.replace(/,/g, "");   // Remove virgulas (milhares)
  }
  
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  
  // Aplica sinal negativo
  const isNegative = isNegativeParens || isNegativePrefix || isNegativeSuffix;
  return isNegative ? -num : num;
}
```

### B) Detector de Linhas Ignoraveis

```typescript
function isSkippableRow(rowObj: Record<string, unknown>, description: string): 
  { skip: boolean; reason?: string } {
  
  const descLower = description.toLowerCase();
  
  // Linhas de total/subtotal/saldo
  const totalKeywords = ["total", "subtotal", "saldo", "soma", "acumulado"];
  if (totalKeywords.some(k => descLower.includes(k))) {
    return { skip: true, reason: "linha_de_total" };
  }
  
  // Linha so com cabecalhos (verifica se valores parecem cabecalhos)
  const allValues = Object.values(rowObj).map(v => String(v).toLowerCase());
  const headerKeywords = ["data", "valor", "descricao", "categoria"];
  const looksLikeHeader = headerKeywords.filter(k => 
    allValues.some(v => v.includes(k))
  ).length >= 2;
  
  if (looksLikeHeader) {
    return { skip: true, reason: "cabecalho_repetido" };
  }
  
  return { skip: false };
}
```

### C) Deteccao de Colunas Credito/Debito

```typescript
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => 
    (h || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  const patterns = {
    description: ["descricao", "historico", "lancamento", "memo", "detalhe"],
    amount: ["valor", "montante", "total", "quantia", "amount"],
    date: ["data", "dt", "competencia", "vencimento", "emissao"],
    type: ["tipo", "natureza", "d/c", "entrada/saida"],
    category: ["categoria", "classificacao", "grupo", "classe"],
    credit: ["credito", "entrada", "receita", "c"],
    debit: ["debito", "saida", "despesa", "d"],
    client_vendor: ["cliente", "fornecedor", "razao social", "empresa"],
  };
  
  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (keywords.some(k => normalizedHeaders[i].includes(k))) {
        mapping[field] = headers[i];
        break;
      }
    }
  }
  
  return mapping;
}
```

### D) Logica de Extracao de Valor

```typescript
function extractAmount(rowObj: Record<string, unknown>, mapping: Record<string, string>): 
  { value: number | null; type: "income" | "expense" } {
  
  // Tenta coluna unica de valor
  if (mapping.amount) {
    const raw = rowObj[mapping.amount];
    const parsed = parseBRL(raw);
    if (parsed !== null) {
      return {
        value: Math.abs(parsed),
        type: parsed >= 0 ? "income" : "expense"
      };
    }
  }
  
  // Tenta colunas credito/debito separadas
  if (mapping.credit || mapping.debit) {
    const creditRaw = mapping.credit ? rowObj[mapping.credit] : null;
    const debitRaw = mapping.debit ? rowObj[mapping.debit] : null;
    
    const credit = parseBRL(creditRaw) || 0;
    const debit = parseBRL(debitRaw) || 0;
    
    if (credit > 0) {
      return { value: credit, type: "income" };
    }
    if (debit > 0) {
      return { value: debit, type: "expense" };
    }
  }
  
  return { value: null, type: "income" };
}
```

### E) Fluxo de Processamento Corrigido

```typescript
const result = {
  rows_read: 0,
  rows_upserted: 0,
  rows_skipped: 0,    // Total + cabecalho + vazias
  rows_failed: 0,     // Erros reais
  errors: [],
  skip_breakdown: {
    empty: 0,
    total_row: 0,
    header_row: 0,
    zero_value: 0,
  },
};

for (const row of rows) {
  result.rows_read++;
  
  // 1. Verifica se e linha ignoravel
  const skipCheck = isSkippableRow(rowObj, description);
  if (skipCheck.skip) {
    result.rows_skipped++;
    result.skip_breakdown[skipCheck.reason]++;
    continue;  // NAO e erro!
  }
  
  // 2. Extrai valor
  const { value, type } = extractAmount(rowObj, mapping);
  
  // 3. Linha vazia ou sem valor
  if (value === null || value === 0) {
    result.rows_skipped++;
    result.skip_breakdown.zero_value++;
    continue;  // Tambem nao e erro!
  }
  
  // 4. Valida data (com fallback)
  const date = parseDate(dateRaw) || new Date().toISOString().split("T")[0];
  
  // 5. Importa
  // ... upsert logic ...
  result.rows_upserted++;
}
```

---

## Arquivos a Modificar

### 1. `supabase/functions/google-sheets-sync/index.ts`

Refatoracao completa:
- Substituir `parseCurrency` por `parseBRL`
- Adicionar `isSkippableRow`
- Adicionar `extractAmount` com suporte a credito/debito
- Melhorar contadores: `rows_skipped` vs `rows_failed`
- Logs mais detalhados por categoria de skip

### 2. `supabase/functions/sheets-preview-mapping/index.ts`

Sincronizar a mesma logica de parsing para preview coerente.

### 3. `src/pages/CashFlowPage.tsx`

Substituir dados mockados por `useTransactions`:
- Agregar transacoes por mes
- Calcular inflow (type="income"), outflow (type="expense"), balance
- Graficos com dados reais

### 4. `src/hooks/useCashFlow.ts` (NOVO)

Hook dedicado para agregacao de fluxo de caixa:
```typescript
export function useCashFlow(period: "month" | "week" | "day") {
  const { transactions } = useTransactions();
  
  const cashFlowData = useMemo(() => {
    // Agregar por periodo
    // Calcular entradas, saidas, saldo acumulado
  }, [transactions, period]);
  
  return { cashFlowData, isLoading };
}
```

---

## Resultados Esperados

### Antes
```
rows_read: 198
rows_upserted: 26
rows_failed: 172  <- PROBLEMA
```

### Depois
```
rows_read: 198
rows_upserted: 175     <- Transacoes reais
rows_skipped: 20       <- Totais + cabecalhos + vazias
rows_failed: 3         <- Erros genuinos (se houver)
skip_breakdown: {
  empty: 5,
  total_row: 8,
  header_row: 4,
  zero_value: 3
}
```

---

## Consistencia Entre Menus

### Receitas (`IncomePage`)
Ja funciona: `useTransactions({ type: "income" })`

### Despesas (`ExpensesPage`)
Ja funciona: `useTransactions({ type: "expense" })`

### Dashboard (`OverviewPage`)
Ja funciona via `KPIGrid` que usa `useTransactions`

### Fluxo de Caixa (`CashFlowPage`)
PRECISA CORRIGIR: Substituir dados mock por `useCashFlow`

---

## Testes de Validacao

### Teste 1: Parsing de Valores
```typescript
// Todos devem parsear corretamente:
parseBRL("R$ 1.234,56") === 1234.56
parseBRL("1.234,56") === 1234.56
parseBRL("-1.234,56") === -1234.56
parseBRL("(1.234,56)") === -1234.56
parseBRL("R$ - 1.234,56") === -1234.56
parseBRL("") === null
parseBRL("TOTAL") === null
```

### Teste 2: Linhas Ignoraveis
```typescript
isSkippableRow({}, "TOTAL GERAL").skip === true
isSkippableRow({}, "Subtotal").skip === true
isSkippableRow({Data:"Data",Valor:"Valor"}, "Data").skip === true
```

### Teste 3: Idempotencia
- Executar sync 3x seguidas
- Verificar que `rows_upserted` permanece estavel
- Verificar que nao ha duplicatas no banco

### Teste 4: UI Consistente
- Receitas mostra apenas `type=income`
- Despesas mostra apenas `type=expense`
- Dashboard mostra KPIs corretos
- Fluxo de Caixa mostra grafico com dados reais

---

## Sequencia de Implementacao

1. **Parser Robusto**: Criar funcao `parseBRL` com todos os formatos BR
2. **Detector de Skip**: Implementar `isSkippableRow`
3. **Edge Function**: Refatorar `google-sheets-sync`
4. **Hook CashFlow**: Criar `useCashFlow`
5. **CashFlowPage**: Integrar com dados reais
6. **Testes**: Validar com amostra de 20 linhas
7. **Deploy e Verificacao**: Confirmar 98%+ de importacao
