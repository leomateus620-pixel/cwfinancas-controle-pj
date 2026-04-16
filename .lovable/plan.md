

## Plano: Resolver erro "CPU Time exceeded" na sincronização

### Problema

A Edge Function `sheets-sync-all-tabs` está excedendo o limite de CPU ao processar a aba Abr2026 (1021 linhas). O erro `WORKER_RESOURCE_LIMIT` ocorre porque:

1. **Updates individuais**: A função `reconcileAndUpsert` faz UPDATE um a um (1 query por linha alterada) — com centenas de linhas isso consome toda a cota de CPU
2. **Reconciliação pesada**: Para cada aba, busca todos os registros existentes do banco e faz matching O(n) por `stable_key` e `content_hash`
3. **Leitura desnecessária de dados xlsx**: Mesmo abas com fingerprint inalterado passam por `xlsxSheetToRows()` antes da verificação de fingerprint

### Solução

**Arquivo: `supabase/functions/sheets-sync-all-tabs/index.ts`**

#### 1. Batch UPDATEs via RPC ou upsert com onConflict
Substituir os updates individuais (loop na linha 1008-1014) por upsert em lotes usando `onConflict: "id"`. Isso reduz ~500 queries individuais para ~10 queries em batch de 50.

```typescript
// ANTES (lento): update individual por id
for (const row of toUpdate) {
  await supabase.from("transactions").update(data).eq("id", id);
}

// DEPOIS (rápido): upsert em lotes com onConflict no id
for (const chunk of chunks(toUpdate, BATCH_UPSERT_SIZE)) {
  await supabase.from("transactions").upsert(chunk, { onConflict: "id" });
}
```

#### 2. Cache de leitura xlsx por aba
Evitar chamar `xlsxSheetToRows()` duas vezes para a mesma aba (uma na classificação e outra no processamento). Criar um cache `Map<string, string[][]>` para reutilizar.

#### 3. Mover fingerprint check ANTES da leitura completa (xlsx)
Para arquivos xlsx, computar o fingerprint usando apenas as primeiras 51 linhas da aba sem ler todas as linhas primeiro. Se fingerprint for igual, pular sem processar.

#### 4. Aumentar BATCH_UPSERT_SIZE
Subir de 50 para 200 para reduzir número de roundtrips ao banco.

### Resultado esperado
- Redução de ~90% nas queries de UPDATE (de N individuais para N/200 em lote)
- Processamento dentro do limite de CPU para abas com até ~2000 linhas
- Sem impacto funcional — mesma lógica de reconciliação, apenas execução mais eficiente

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/sheets-sync-all-tabs/index.ts` |

