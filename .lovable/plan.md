

## Plano: Tratamento Global de Transferências + Lista Recolhível de Receitas

### Diagnóstico

**Tarefa 1 — Transferências internas:**
O sistema já possui `movement_type = "TRANSFER"` e lógica de detecção nos pipelines de sync (`sheets-sync-all-tabs`, `parse-excel-upload`). A maioria dos consumidores já filtra corretamente. **Lacunas encontradas:**

| Local | Problema |
|---|---|
| `ai-generate-insights/index.ts` (linha 393) | Query de transações **não filtra** `movement_type != TRANSFER` — transferências poluem insights da IA |
| `rebuild-categories/index.ts` | Não filtra transfers — pode recategorizar transfers como receita/despesa |
| `useCashFlow.ts` (linha 28) | Chama `useTransactions()` sem `excludeTransfers` — porém trata transfers separadamente no `useMemo`. OK mas frágil |
| `useTransactions.ts` `totals` (linha 128) | Se chamado **sem** `excludeTransfers`, os totals incluem transfers. O `useHomeDashboard` não usa totals, mas é um risco latente |

**Tarefa 2 — Lista recolhível:** Direto, sem complexidade.

---

### Mudanças — Tarefa 1

**1. `supabase/functions/ai-generate-insights/index.ts` (~linha 394)**
- Adicionar `.neq("movement_type", "TRANSFER")` na query de transações

**2. `supabase/functions/rebuild-categories/index.ts`**
- Na query que busca transações para recategorizar, adicionar `.neq("movement_type", "TRANSFER")` para não processar transfers

**3. `src/hooks/useTransactions.ts` — Tornar `excludeTransfers: true` o default**
- Mudar o default de `excludeTransfers` para `true` (invertendo a lógica)
- Renomear para `includeTransfers?: boolean` (default `false`) para clareza
- Ajustar `useCashFlow.ts` para passar `includeTransfers: true` (único consumidor que precisa de transfers)
- Ajustar `useHomeDashboard.ts` para remover filtros manuais redundantes de `movement_type !== "TRANSFER"` — agora o hook já exclui por padrão
- O cálculo de `totals` no hook passará a excluir transfers automaticamente

**4. Consumidores — verificar/ajustar:**
- `useOverviewData.ts`: já passa `excludeTransfers: true` → ajustar para nova API
- `IncomePage.tsx`: já passa `excludeTransfers: true` → ajustar
- `ExpensesPage.tsx`: já passa `excludeTransfers: true` → ajustar
- `useCashFlow.ts`: passa `includeTransfers: true` (precisa de transfers para exibição separada)
- `useHomeDashboard.ts`: remove filtros manuais `(t as any).movement_type !== "TRANSFER"` — agora desnecessários

---

### Mudanças — Tarefa 2

**`src/pages/IncomePage.tsx`**
- Envolver a seção "Transações de Receita" (tabela + paginação, linhas 342-434) em um `Collapsible` do shadcn
- Estado `const [listOpen, setListOpen] = useState(false)` — inicia recolhido
- Botão trigger com ícone ChevronDown/ChevronUp e label "Mostrar transações" / "Ocultar transações"
- O header da seção (título + filtros + busca) fica no `CollapsibleTrigger`
- A tabela e paginação ficam no `CollapsibleContent`
- Sem impacto em dados, filtros ou carregamento

---

### Arquivos modificados

| Arquivo | Tipo |
|---|---|
| `src/hooks/useTransactions.ts` | Inverter default: excluir transfers por padrão |
| `src/hooks/useHomeDashboard.ts` | Remover filtros manuais redundantes |
| `src/hooks/useCashFlow.ts` | Passar `includeTransfers: true` |
| `src/hooks/useOverviewData.ts` | Ajustar para nova API |
| `src/pages/IncomePage.tsx` | Ajustar API + lista recolhível |
| `src/pages/ExpensesPage.tsx` | Ajustar API |
| `supabase/functions/ai-generate-insights/index.ts` | Filtrar transfers |
| `supabase/functions/rebuild-categories/index.ts` | Filtrar transfers |

### Segurança
- Nenhum registro é alterado ou removido no banco
- Lógica de classificação no sync permanece intacta
- Apenas a camada de leitura/exibição é afetada
- `useCashFlow` mantém acesso a transfers para exibição separada no Fluxo de Caixa

