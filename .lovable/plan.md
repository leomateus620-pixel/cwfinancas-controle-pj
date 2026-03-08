

## Plan: Corrigir mapeamento de categorias — headers com espaços

### Problema

A planilha "Tarifa Zero" tem headers com espaços extras (ex: `" Categoria "`, `" Valor "`). O sistema normaliza corretamente para detectar o tipo de coluna, mas armazena o header **original** (com espaços) no mapping. Na hora de construir o `rowObj`, as chaves são **trimadas**. Resultado: `rowObj[" Categoria "]` → `undefined` → fallback `"Geral"`.

Dados confirmam: `raw_data` mostra `Categoria: "Pró-labore"`, mas `category` no banco é `"Geral"` para todas as 127+ transações desta planilha.

### Causa raiz

**`supabase/functions/sheets-sync-all-tabs/index.ts`**, linha 485:
```typescript
mapping[field] = headers[i]; // original header com espaços
```

Linha 2094-2095 (build rowObj):
```typescript
const key = safeStr(h).trim(); // header trimado
rowObj[key] = row[i];
```

O mapping guarda `" Categoria "` mas rowObj usa `"Categoria"` como chave → mismatch.

### Solução

**`supabase/functions/sheets-sync-all-tabs/index.ts`** — Uma única mudança na função `autoDetectMapping`:

Linha 485: Trimar o header antes de armazenar no mapping:
```typescript
mapping[field] = safeStr(headers[i]).trim() || headers[i];
```

Isso garante que as chaves do mapping coincidam com as chaves do `rowObj`. Afeta apenas a resolução de headers — não muda a detecção, não muda nenhum outro fluxo.

### Verificação adicional

Confirmar que `google-sheets-sync/index.ts` (pipeline legado) e `parse-excel-upload/index.ts` não têm o mesmo bug. Se tiverem, aplicar a mesma correção.

### O que NÃO muda
- Tab router e classificação de abas
- Lógica de DRE, APR, forecast
- Detecção por densidade de valores
- Nenhum outro menu ou fluxo existente

