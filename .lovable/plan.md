

## Plano: Corrigir erro de duplicação na sincronização DRE

### Diagnóstico

**Erro**: `duplicate key value violates unique constraint "dre_periods_unique_period_scenario"`

**Causa raiz**: A limpeza antes do INSERT é fragmentada — cada parser (DEFAULT, SAH, GR, STARTSYNC, LCF_NUCLEO) limpa apenas períodos do seu próprio `template_type`. Quando a detecção de template muda entre sincronizações (ex: de DEFAULT para GR), os períodos antigos com `template_type` diferente mas mesma `period_key` permanecem no banco, causando violação da constraint única `(user_id, sheet_id, period_key, COALESCE(scenario, '__none__'))`.

### Solução

Adicionar uma **limpeza global no início** da sincronização (antes de qualquer parsing), deletando TODOS os `dre_periods` e `dre_lines` do `user_id + sheet_id` (connection_id). Isso é seguro porque a sync sempre reimporta todos os dados de todas as abas DRE da planilha.

### Mudança

**Arquivo: `supabase/functions/dre-sync/index.ts`**

Após obter as abas candidatas (linha ~1877), antes do loop de parsing (linha ~1894), inserir:

```typescript
// Global cleanup: delete ALL existing DRE data for this connection
// This prevents duplicate key errors when template_type changes between syncs
const { data: allOldPeriods } = await supabase
  .from("dre_periods")
  .select("id")
  .eq("user_id", userId)
  .eq("sheet_id", connection_id);

if (allOldPeriods && allOldPeriods.length > 0) {
  const allOldIds = allOldPeriods.map((p: any) => p.id);
  await supabase.from("dre_validation_issues").delete().in("period_id", allOldIds);
  await supabase.from("dre_lines").delete().in("period_id", allOldIds);
  await supabase.from("dre_periods").delete().in("id", allOldIds);
}
```

Em seguida, marcar todos os cleanups individuais dentro dos parsers para que sejam **ignorados** (já que a limpeza global já foi feita). A forma mais segura: cada parser interno já tem seu bloco de cleanup — como a limpeza global já rodou, esses blocos simplesmente não encontrarão nada para deletar, então **não precisam ser removidos**. Nenhum risco de dupla execução.

### Escopo restrito

- **Apenas 1 arquivo modificado**: `supabase/functions/dre-sync/index.ts`
- **Apenas inserção de ~12 linhas** no handler principal
- **Zero alteração** nos parsers individuais, na lógica de detecção ou na UI
- **Zero impacto** nos fluxos de transações, APR, bank_balances ou qualquer outro pipeline

### Verificação

Após a correção, invocar a edge function `dre-sync` para confirmar que a sincronização passa sem erro 500.

