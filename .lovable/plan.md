

## Plano: Corrigir categorias de receitas e classificação de transferências

### Diagnóstico

Analisei os dados reais no banco e encontrei **dois bugs** no pipeline de importação (`sheets-sync-all-tabs`):

**Bug 1 — `looksLikeBankName` muito agressivo (424 receitas afetadas)**

A função `looksLikeBankName` usa `v.includes(bankName)`. O valor "Receita Asaas" contém "asaas" → é incorretamente classificado como nome de banco → categoria vira "Sem categoria". Mas "Receita Asaas" é uma categoria legítima de receita de cobranças.

Dados reais: 364 transações com `raw_data.Categoria = "Receita Asaas"` → importadas como "Sem categoria".

**Bug 2 — Transfer detection roda DEPOIS da sanitização (123 transferências vazando)**

A linha 2370-2371 substitui a categoria por "Sem categoria" ANTES de `detectMovementType()` na linha 2390. Quando a categoria original é "Transferência interna" e contém "asaas" → vira "Sem categoria" → `detectMovementType` não detecta mais como TRANSFER → transação vaza para os gráficos como INCOME/EXPENSE.

Dados reais: 123 transações com `Categoria = "Transferência interna"` que não foram classificadas como TRANSFER.

### Solução

**Arquivo: `supabase/functions/sheets-sync-all-tabs/index.ts`**

1. **Reordenar a lógica**: Mover `detectMovementType` para ANTES da sanitização de banco. Usar a categoria RAW da planilha para detectar transferências:

```
// ANTES (bugado):
let category = raw || "Geral";
if (looksLikeBankName(category)) category = "Sem categoria";  // mata "Transferência interna"
movementType = detectMovementType(category, ...);              // não detecta mais

// DEPOIS (corrigido):
let rawCategory = raw || "Geral";
movementType = detectMovementType(rawCategory, ...);           // detecta com categoria original
let category = rawCategory;
if (looksLikeBankName(category)) category = "Sem categoria";
```

2. **Refinar `looksLikeBankName`**: A função deve verificar se o valor é PURAMENTE um nome de banco, não um composto como "Receita Asaas". Adicionar exceções para categorias que CONTÊM um banco mas têm prefixo de receita/despesa:

```typescript
function looksLikeBankName(value: string): boolean {
  const v = normalize(value);
  if (!v) return false;
  // If value starts with revenue/expense prefix, it's a category, not a bank
  const categoryPrefixes = ["receita", "despesa", "custo", "taxa", "tarifa", "pagamento"];
  if (categoryPrefixes.some(p => v.startsWith(p))) return false;
  return BANK_NAMES.some(b => v.includes(b) || v === b);
}
```

3. **Mesma correção no `rebuild-categories/index.ts`**: Aplicar a mesma lógica de prefixos de categoria.

**Arquivo: `supabase/functions/rebuild-categories/index.ts`**

4. **Ampliar escopo de fix**: O `rebuild-categories` atualmente só corrige categorias que são "bank names" ou "Geral". Expandir para também corrigir "Sem categoria" quando o `raw_data` contém uma categoria válida. Mudar a condição de `currentIsBad`:

```typescript
const currentIsBad = looksLikeBankName(currentCategory) 
  || currentCategory === "Geral" 
  || currentCategory === "Sem categoria";
```

### Dados a corrigir

Após deploy, chamar `rebuild-categories` para re-processar as 424+ transações com categorias erradas. Isso será feito automaticamente pela função já existente.

### Escopo restrito

- **2 arquivos edge function** modificados
- **Zero alteração** na UI, hooks ou componentes React
- **Zero impacto** em DRE, APR, bank_balances ou forecast
- Transferências internas já são excluídas pela UI (`useTransactions` exclui `TRANSFER` por padrão)

### Verificação

Após deploy, invocar `rebuild-categories` e consultar a contagem de categorias para confirmar que "Sem categoria" e "Geral" diminuíram significativamente, e que transações com "Transferência interna" no raw_data passaram para `movement_type = TRANSFER`.

