

## Plan: Liquid Glass Premium para Receitas e Despesas

Aplicar o design system Liquid Glass já existente (classes `liquid-glass-card`, `liquid-glass-kpi`, `liquid-glass-tooltip`) nas páginas `/income` e `/expenses`, substituindo os `Card` genéricos por containers glass premium com tooltips, gráficos e tabelas refinados.

### Arquivos a modificar

| Arquivo | Escopo |
|---------|--------|
| `src/pages/IncomePage.tsx` | Substituir `Card` por divs `liquid-glass-card`, tooltips glass, gráficos com gradientes/glow, tabela glass |
| `src/pages/ExpensesPage.tsx` | Mesmo tratamento: containers glass, tooltip glass, progress bars refinadas, tabela glass |

### Mudanças detalhadas

**IncomePage.tsx:**
1. KPIs: grid de 3 cards já usa `KPICard` (que já é `liquid-glass-kpi`) — manter, mas envolver em orbes decorativos como na ExpensesPage
2. Gráfico de Receita Mensal: trocar `Card` por `div className="liquid-glass-card p-6"`, tooltip com classe `liquid-glass-tooltip`, barras com `radius={[8,8,0,0]}` e fill em gradiente via `<defs><linearGradient>`
3. Gráfico de Receita por Categoria (Pie): mesmo container glass, donut com `innerRadius={65} outerRadius={95}` (aro mais espesso), tooltip glass, legenda com pills glass
4. Tabela de Transações: container `liquid-glass-card`, header da tabela com `bg-muted/20`, rows com hover `hover:bg-white/40`, badges de categoria como glass pills, ícones em cápsulas glass
5. Header: botão "Nova Receita" com estilo glass-capsule
6. Busca e filtros: inputs com bordas glass sutis

**ExpensesPage.tsx:**
1. KPIs: já tem orbes — refinar para consistência
2. Gráfico de Despesas Mensais (Line): container glass, linha com `strokeWidth={2.5}`, filtro glow via `<defs><filter>`, `<linearGradient>` para `<Area>` translúcida abaixo da linha, tooltip glass
3. Gastos por Categoria (Progress bars): container glass, barras de progresso com cantos mais arredondados e gradientes sutis, labels mais refinados
4. Tabela: mesmo tratamento que IncomePage — container glass, rows elegantes, badges pill
5. Header e filtros: mesmo refinamento

**Padrão de tooltip glass** (ambas páginas):
```tsx
<div className="liquid-glass-tooltip">
  <p className="text-sm font-medium">{label}</p>
  <p className="text-lg font-semibold">{value}</p>
</div>
```

**Padrão de container glass** (substituindo `<Card>`):
```tsx
<div className="liquid-glass-card p-6">
  <div className="mb-4">
    <h3 className="text-base font-semibold">Título</h3>
    <p className="text-sm text-muted-foreground">Subtítulo</p>
  </div>
  {/* conteúdo */}
</div>
```

### O que NÃO muda
- Lógica de dados, hooks, queries, mutations
- Funcionalidade de filtros, busca, modal de transação
- Schema do banco

