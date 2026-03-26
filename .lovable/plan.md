

## Plano: Reestruturar Card "Categorias de Despesas" como Componente Analítico Principal

### Layout Atual vs Novo

```text
ATUAL:
┌─────────────────┬─────────────────┐
│ Despesas Mensais│ Categorias (pie)│  ← 50/50
└─────────────────┴─────────────────┘
┌───────────────────────────────────┐
│ Top 5 Maiores Gastos              │
└───────────────────────────────────┘

NOVO:
┌───────────────────────────────────┐
│ CATEGORIAS DE DESPESAS (dominante)│  ← full-width
│ Header executivo + resumo         │
│ Donut grande + Grid de categorias │
│ Insights analíticos               │
└───────────────────────────────────┘
┌─────────────────┬─────────────────┐
│ Despesas Mensais│ Top 5 Gastos    │  ← secundários
└─────────────────┴─────────────────┘
```

### Mudanças

**Arquivo: `src/pages/ExpensesPage.tsx`** — único arquivo modificado

1. **Novo layout da seção de gráficos (linhas 272-401)**:
   - Card "Categorias" sai do grid 50/50 e vira **full-width** acima
   - Card "Despesas Mensais" desce para grid 50/50 com "Top 5 Maiores Gastos"

2. **Novo card "Categorias de Despesas" com**:
   - **Header executivo**: título, subtítulo, mini-resumo (total categorias, total gasto, maior categoria)
   - **Layout interno desktop**: donut à esquerda (maior, innerRadius=70, outerRadius=130, paddingAngle=3) + grid de categorias à direita em 2 colunas
   - **Layout tablet**: donut acima, grid 2 colunas abaixo
   - **Layout mobile**: donut acima, grid 1 coluna abaixo
   - **Sem scroll interno**: grid usa altura natural
   - **Paleta expandida**: 12+ cores com alta diferenciação
   - **Estado `activeIndex`**: hover na lista destaca fatia (opacity), hover na fatia destaca item na lista — sincronização bidirecional via `onMouseEnter`/`onMouseLeave` + Recharts `activeIndex`
   - **Tooltip premium**: nome, valor formatado, percentual, ranking (#1, #2...)
   - **Labels no gráfico**: apenas categorias ≥4% mostram label direto na fatia
   - **Grid de categorias**: cada item tem dot de cor, nome, %, valor, ranking discreto, count de transações (já disponível via `transactions.filter`)
   - **Insights no rodapé** (max 3, useMemo): maior categoria + %, concentração top 3, dispersão

3. **Dados**: zero mudança — mesmos `pieData`, `validCategoryBreakdown`, `totalValidCategories` já existentes. Adicionar apenas:
   - `useMemo` para count por categoria (do array `transactions` já carregado)
   - `useMemo` para insights (derivado de `pieData`)
   - `useState<number | null>` para `activeIndex`

4. **Top 5 Maiores Gastos**: mover para grid secundário ao lado de "Despesas Mensais", adaptado para caber em card glass compacto

### Responsividade

| Viewport | Categorias | Despesas Mensais + Top 5 |
|----------|-----------|-------------------------|
| Desktop (lg+) | Donut esquerda + grid 2col direita | Grid 2 colunas abaixo |
| Tablet (sm-lg) | Donut acima + grid 2col abaixo | Stack vertical |
| Mobile (<sm) | Donut centralizado + grid 1col | Stack vertical |

### Escopo restrito
- **1 arquivo**: `src/pages/ExpensesPage.tsx`
- Zero novos hooks, queries, endpoints
- Mesmos dados, mesma origem
- Sem impacto em outros cards, filtros ou navegação

