

## Plano: Reformulação Premium do Menu Controle de Despesas

### Arquivo modificado

| Arquivo | Ação |
|---|---|
| `src/pages/ExpensesPage.tsx` | Reescrita completa (visual + estrutura, mesma lógica de dados) |

### Mudanças

**Reescrita de `ExpensesPage.tsx`** preservando todos os hooks, handlers, filtros, paginação e modal existentes. Apenas a camada de apresentação muda.

**1. Header analítico** — Subtítulo dinâmico (`{transactions.length} lançamentos no período`), botões Exportar + Nova Despesa com estilo premium glass.

**2. 4 KPIs** (grid `sm:grid-cols-2 lg:grid-cols-4`, stagger animation):
- Total de Despesas (`formatCurrencyBR(totals.expense)`, ícone CreditCard, cor destructive)
- Quantidade de Lançamentos (`transactions.length`, ícone Receipt)
- Ticket Médio (`totals.expense / transactions.length`, ícone Calculator)
- Maior Categoria (top válida excluindo "Sem categoria", ícone Building2)

Cada card em `liquid-glass` com orbe decorativo.

**3. Insight banner** — Card contextual:
- Filtra `categoryBreakdown` removendo "Sem categoria", vazios, null
- Se houver top válida: `"Sua maior concentração de despesas está em {X}, representando {Y}% do total"`
- Se não houver: oculto
- Ícone Lightbulb, estilo `liquid-glass`

**4. Gráfico mensal** — Manter ComposedChart (Area+Line) existente, adicionar `animationDuration={800}` em Area e Line.

**5. Gráfico de categorias — PieChart** — Substituir barras de progresso por `PieChart` (Recharts):
- Dataset derivado: `categoryBreakdown.filter(c => c.category && c.category.trim() !== "" && c.category.toLowerCase() !== "sem categoria")`
- Ordenar por valor decrescente
- `PieChart` com `Pie` usando `innerRadius={60}`, `outerRadius={100}`
- Cores do `CHART_COLORS` palette (reutilizar padrão do IncomePage)
- Legenda vertical ao lado com nome + valor + percentual
- Tooltip premium glass com valor e percentual

**6. Top 5 maiores gastos** — Grid de mini cards (`liquid-glass` compacto):
- `[...transactions].sort((a,b) => Number(b.amount) - Number(a.amount)).slice(0,5)`
- Cada card: descrição, badge de categoria, valor formatado, data

**7. Lista recolhível** — Mesmo padrão do IncomePage:
- `const [listOpen, setListOpen] = useState(false)`
- Botão toggle com ChevronDown/Up e label
- Filtros + tabela + paginação dentro de collapsible (usando altura condicional, não Radix Collapsible)

**8. Imports adicionais**: `PieChart, Pie, Cell`, `Receipt, Calculator, Lightbulb, ChevronDown, ChevronUp`

### Dados computados (todos client-side)

```typescript
const isValidCategory = (cat: string) => cat && cat.trim() !== "" && cat.toLowerCase() !== "sem categoria";

const validCategoryBreakdown = categoryBreakdown
  .filter(item => isValidCategory(item.category))
  .sort((a, b) => b.amount - a.amount);

const topCategoryData = validCategoryBreakdown[0];
const topPercent = topCategoryData && totals.expense > 0
  ? ((topCategoryData.amount / totals.expense) * 100).toFixed(0) : "0";

const avgExpense = transactions.length > 0 ? totals.expense / transactions.length : 0;

const top5Transactions = [...transactions]
  .sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
```

### Preservado sem alteração
- `useTransactions({ type: "expense" })`, `TransactionModal`, `usePagination`
- Filtros, busca, edição, paginação, handlers
- Backend, cálculos, arquitetura de dados

