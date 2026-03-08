

## Plan: Redesign Completo do Dashboard — Liquid Glass Premium

Este plano transforma o Dashboard (`/overview`) em uma interface premium com estética Liquid Glass, mantendo toda a funcionalidade existente e elevando drasticamente o padrão visual.

### Arquivos a modificar

| Arquivo | Escopo |
|---------|--------|
| `src/index.css` | Novo background mesh, classes glass para dashboard, tooltips glass, sidebar refinada |
| `src/components/layout/DashboardLayout.tsx` | Background premium com gradientes e noise no main |
| `src/components/layout/DashboardHeader.tsx` | Header glass com blur, inputs e botões em estilo cápsula premium |
| `src/components/layout/AppSidebar.tsx` | Sidebar glass fosco refinada, item ativo com glow e profundidade |
| `src/pages/OverviewPage.tsx` | Layout reestruturado com hierarquia visual clara, hero card elevado |
| `src/components/dashboard/KPICard.tsx` | Cards glass translúcidos com blur, highlight interno, ícones em cápsulas |
| `src/components/dashboard/KPIGrid.tsx` | Loading skeleton glass |
| `src/components/dashboard/RevenueChart.tsx` | Gráfico com container glass, tooltip glass, gradientes mais sofisticados, glow na linha |
| `src/components/dashboard/ExpenseChart.tsx` | Barras com gradientes, container glass, tooltip glass |
| `src/components/dashboard/ProfitDistributionChart.tsx` | Donut mais espesso, container glass, legenda premium |
| `src/components/dashboard/DataQualityCard.tsx` | Container glass, indicador circular premium com glow sutil |
| `src/components/dashboard/RecentTransactions.tsx` | Container glass, rows mais elegantes |
| `src/components/corporate/CorporateCard.tsx` | Upgrade para liquid-glass com blur e highlight |
| `src/components/ui/trend-badge.tsx` | Estilo pill glass premium com backdrop-blur |

### Mudanças detalhadas

**1. CSS Global (`index.css`)** — Adicionar:
- `.dashboard-glass-bg`: background com gradiente mesh frio (azul/ciano/verde muito sutil), noise texture overlay
- `.liquid-glass-card`: card system padrão para dashboard — `rgba(255,255,255,0.6)`, `backdrop-blur(20px)`, border luminosa top, inner highlight, shadow macia, `border-radius: 20px`
- `.liquid-glass-card-hero`: variante hero com mais presença — glass mais evidente, gradiente radial interno, highlight de luz no topo
- `.liquid-glass-tooltip`: tooltip glass com blur e borda sutil
- `.liquid-glass-kpi`: variante KPI com cantos mais arredondados e hover com elevação sutil
- Refinar `.sidebar-glass` para fundo fosco mais elegante, hover com "placa flutuante"
- `.glass-pill-badge`: badge/trend em estilo pill premium com backdrop-blur

**2. DashboardLayout** — Aplicar `dashboard-glass-bg` no `<main>`, criando o fundo com profundidade (gradientes difusos + noise)

**3. Header** — Glass premium:
- Background translúcido com blur intenso
- Campo de busca com borda glass sutil
- Botões de exportar e período como cápsulas premium com hover suave
- Avatar com borda glass

**4. Sidebar** — Refinar:
- Item ativo: fundo translúcido azul com borda sutil clara, glow suave, sombra macia
- Hover: placa flutuante com elevação sutil
- Separadores mais discretos
- Melhor espaçamento

**5. Hero Card (Resultado do Período)** — Transformar em ponto focal:
- Usar `liquid-glass-card-hero` com mais altura e presença
- Gradiente radial sutil no fundo
- Highlight de luz no topo
- Valor principal maior (text-4xl/5xl) com tipografia mais forte
- Badge percentual redesenhada como glass pill
- Sparkline ou elemento decorativo sutil no canto

**6. KPI Cards** — Redesign completo:
- Container `liquid-glass-kpi` com backdrop-blur
- Ícones dentro de cápsulas glass arredondadas
- Valores com mais presença tipográfica
- Labels menos apagados
- Trend badge em estilo pill glass
- Hover com elevação e glow sutil contextual (azul/verde/vermelho)

**7. Gráficos** — Todos com container glass:
- **Receita**: linha mais suave com strokeWidth refinado, glow sutil via filter, preenchimento gradiente translúcido mais presente, tooltip glass, legenda refinada
- **Despesas**: barras com gradiente sutil, tooltip glass, melhor espaçamento
- **Distribuição**: donut com innerRadius/outerRadius ajustados (aro mais espesso), centro com tipografia premium, legenda com pills glass
- **Qualidade**: indicador circular com glow verde sutil, container glass, acabamento mais nobre

**8. Tooltips dos gráficos** — Padronizar todos com:
- Background `rgba(255,255,255,0.85)`, `backdrop-blur(16px)`
- Borda sutil, cantos arredondados, sombra refinada

**9. TrendBadge** — Redesign para glass pill:
- `backdrop-blur(8px)`, background translúcido
- Borda mais sutil
- Sem animação pulse excessiva

**10. Hierarquia visual** — No OverviewPage, criar 3 níveis claros:
- Nível 1: Hero card (máximo destaque)
- Nível 2: KPIs (4 cards glass)
- Nível 3: Gráficos e painéis (containers glass mais discretos)
- Espaçamento `space-y-8` entre níveis para mais respiração

### O que NÃO muda
- Lógica de dados, hooks, queries
- Estrutura de rotas
- Funcionalidade existente
- Schema do banco

