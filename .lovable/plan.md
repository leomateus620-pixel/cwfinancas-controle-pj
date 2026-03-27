

## Plano: Refinar visual das categorias e corrigir bugs de re-render do gráfico

### Problemas identificados

**Re-render/animação**: 
- `isAnimationActive={activeIndex === null}` faz a animação reiniciar toda vez que o hover sai (null→index→null toggling)
- Tooltip inline cria nova função a cada render → causa re-render do Pie
- `label` inline function recriada a cada render
- `onMouseEnter`/`onMouseLeave` inline no Pie recriam refs

**Visual da lista**: Layout funcional mas sem acabamento premium — linhas "soltas", hover genérico, sem separação visual elegante

### Solução

**Arquivo: `src/pages/ExpensesPage.tsx`** — único arquivo

#### 1. Performance e estabilidade (eliminar re-renders)

- Extrair componente `CategoryDonutChart` com `React.memo` — recebe `pieData` e `activeIndex`/`setActiveIndex` como props estáveis
- Memoizar com `useCallback`: `onPieEnter`, `onPieLeave`, `renderLabel`, `renderActiveShape`
- Memoizar Tooltip content como componente separado (`const DonutTooltip = React.memo(...)`)
- Mudar `isAnimationActive` para um `useRef(true)` que vira `false` após a primeira renderização (animação roda só 1x na entrada, nunca mais reinicia)
- Extrair componente `CategoryListItem` com `React.memo` para cada item do grid

#### 2. Visual premium da lista de categorias

Cada item vira um micro-card analítico:

```text
┌─────────────────────────────────────────┐
│ #1  ● Impostos e Taxas                  │
│        42 lançamentos    R$ 15.200  31%  │
└─────────────────────────────────────────┘
```

- Fundo `bg-card/40 backdrop-blur-sm` com `border border-border/20` no estado normal
- Hover: `bg-secondary/60 border-border/40 shadow-sm` com `transition-all duration-200`
- Active (sincronizado): borda com cor da categoria (`border-l-2` + cor) + fundo mais visível
- Rank em badge discreto (`bg-muted/40 rounded-md w-5 h-5 text-[10px] font-bold`)
- Dot de cor maior (`w-2.5 h-2.5`) com sutil box-shadow matching
- Nome com `font-medium text-[13px]`
- Count como `text-[10px] text-muted-foreground`
- Valor e % alinhados à direita com hierarquia clara (valor `font-semibold text-sm`, % `text-[10px] text-muted-foreground`)
- Gap vertical `gap-y-2` (de 1.5 para 2) para mais respiro

#### 3. Animações suaves

- Entrada do gráfico: 1x only via ref, 800ms ease-out
- Hover nos itens: `transition-all duration-200 ease-out` (sem scale, apenas cor/borda/sombra)
- Fatia ativa: opacity transition via CSS `transition: opacity 150ms ease` no Cell
- Sem bounce, sem reinício, sem jank

#### 4. Sincronização refinada

- `activeIndex` state permanece no componente pai
- `CategoryDonutChart` recebe via props (memo-safe)
- `CategoryListItem` recebe `isActive` boolean (memo-safe)
- Hover na lista → `setActiveIndex(i)` → Pie recebe novo activeIndex sem re-mount
- Hover no Pie → `setActiveIndex(i)` → List items re-check `isActive` boolean

### Escopo
- **1 arquivo**: `src/pages/ExpensesPage.tsx`
- Zero novos hooks, queries ou endpoints
- Zero impacto em outros cards/páginas

