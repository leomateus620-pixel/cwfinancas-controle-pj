

## Plano: Seletor de quantidade de categorias + visual premium nos cards

### Mudanças em `src/pages/ExpensesPage.tsx`

**1. Seletor de categorias visíveis**

- Novo `useState` para `visibleCount` com default `10`
- Opções: `10`, `20`, `30`, `"all"` (total)
- Select discreto no header do card, ao lado dos resumos (Categorias / Total / Líder)
- `pieData` e grid usam `.slice(0, visibleCount)` — os dados originais não mudam
- Donut e lista sempre mostram do maior para o menor (já está assim)
- O seletor atualiza `pieData` filtrado via `useMemo`
- Percentuais recalculados sobre o total real (`totals.expense`), não sobre o subtotal visível

**2. Visual premium dos `CategoryListItem`**

Elevar acabamento de cada item:

- Fundo com `bg-white/[0.04] backdrop-blur-sm` + `border border-white/[0.06]`
- Hover: `bg-white/[0.08] border-white/[0.12] shadow-[0_2px_12px_rgba(0,0,0,0.08)]`
- Active: borda esquerda com cor da categoria + `bg-white/[0.1]` + sutil glow via box-shadow com cor da categoria
- Rank badge com `bg-white/[0.06] border border-white/[0.08]`
- Dot de cor com glow mais pronunciado (`0 0 8px color/50`)
- Transições `duration-200 ease-out`
- Arredondamento `rounded-2xl` (de `rounded-xl`)

**3. Escopo**
- 1 arquivo: `src/pages/ExpensesPage.tsx`
- Zero novos hooks/queries
- Zero impacto em cálculos ou outros cards

