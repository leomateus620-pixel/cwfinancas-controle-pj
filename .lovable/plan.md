

## Plano: Garantir que mudanças na planilha sejam sempre refletidas no sistema

### Problema raiz

Quando o usuário clica "Atualizar" na página de Contas a Pagar/Receber, o sistema verifica o **Drive fingerprint** (`modifiedTime` do Google Drive). Se ele não mudou desde a última sync (cache do Google, ou sync rápida demais), o sistema pula toda a sincronização — **nenhum dado é relido da planilha**. Por isso a mudança de "Pago" de volta para "Pendente" não foi refletida.

Além disso, o mesmo problema afeta **todos os fluxos do sistema** que usam o botão de sync manual: Dashboard, Receitas, Despesas, Fluxo de Caixa, etc.

### Solução (3 mudanças)

#### 1. Frontend: sempre enviar `force_refresh: true` em syncs manuais

**Arquivo**: `src/hooks/useGoogleSheets.ts`

Na mutation `syncAllTabs`, adicionar suporte ao parâmetro `force_refresh` e passá-lo ao body da Edge Function:

```typescript
mutationFn: async ({ connectionId, selectedTabs, monthRange, forceRefresh }: { 
  connectionId: string; selectedTabs?: string[]; monthRange?: MonthRange; forceRefresh?: boolean 
}) => {
  const { data, error } = await supabase.functions.invoke("sheets-sync-all-tabs", {
    body: { 
      connection_id: connectionId, selected_tabs: selectedTabs, 
      month_range: monthRange, force_refresh: forceRefresh ?? true  // default true for manual syncs
    },
  });
```

Fazer o mesmo para `syncData` (pipeline legado).

#### 2. Frontend: AccountsPage e GoogleSheetsPage já passam `forceRefresh`

**Arquivo**: `src/pages/AccountsPage.tsx` — na chamada `syncAllTabs.mutate`, não precisa de mudança se o default for `true`.

**Arquivo**: `src/pages/GoogleSheetsPage.tsx` — idem.

#### 3. Backend: remover tab fingerprint skip para abas APR (já não existe, confirmar)

**Arquivo**: `supabase/functions/sheets-sync-all-tabs/index.ts` — confirmar que o APR pipeline (linhas 2329+) NÃO aplica tab fingerprint (já verificado que não aplica). Apenas garantir que quando `force_refresh=true`, o Drive fingerprint também é ignorado (já implementado na linha 1864).

### Impacto
- Toda sync manual (botão "Atualizar" ou "Sincronizar") relerá os dados da planilha, garantindo que mudanças de status, valor ou novas contas sejam refletidas
- Syncs automáticas (scheduled) continuam usando fingerprint para eficiência
- Nenhuma mudança no schema do banco, RLS ou frontend visual

