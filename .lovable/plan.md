

# Reestilizacao Home: Fundo Branco com Liquid Glass

## O que muda

Trocar o fundo escuro (preto/dark) por um fundo branco texturizado com efeito liquid glass. Todos os cards, textos e cores serao adaptados para funcionar sobre fundo claro, mantendo o efeito premium de vidro/glass.

---

## Mudancas Detalhadas

### 1. `src/index.css` — Classes Liquid Glass

**`.home-dark-bg`** sera renomeada para **`.home-glass-bg`**:
- Fundo: branco (`hsl(210 40% 98%)`) com gradientes coloridos sutis (azul, verde, roxo em ~3-5% opacidade)
- Textura noise sutil via pseudo-element para materialidade

**`.liquid-glass`** — versao light:
- Background: `rgba(255, 255, 255, 0.65)` (vidro branco translucido)
- Backdrop-filter: `blur(24px) saturate(120%)`
- Border: `1px solid rgba(15, 23, 42, 0.06)` (borda escura sutil)
- Border-top: `1px solid rgba(255, 255, 255, 0.8)` (highlight luminoso no topo)
- Box-shadow: sombras suaves com tons slate
- Hover: borda levemente mais visivel + sombra mais profunda

**`.liquid-glass-highlight`** — versao light com glow azul:
- Border com tom azul primary a ~15% opacidade
- Glow difuso azul no box-shadow

**`.liquid-glass-compact`** — versao light reduzida

### 2. `src/pages/HomePage.tsx` — Cores de texto

Todas as referencias a `text-white/*` serao trocadas para cores escuras:
- `text-white` -> `text-foreground` (titulos)
- `text-white/90` -> `text-foreground/90`
- `text-white/80` -> `text-foreground/80`
- `text-white/60` -> `text-muted-foreground`
- `text-white/50` -> `text-muted-foreground`
- `text-white/40` -> `text-muted-foreground/70`
- `text-white/30` -> `text-muted-foreground/50`
- `text-white/25` -> `text-muted-foreground/40`
- `text-white/10` -> `text-border`
- `bg-white/5`, `bg-white/10`, `bg-white/15` -> `bg-foreground/5`, `bg-foreground/[0.03]`, etc.
- Classe `home-dark-bg` -> `home-glass-bg`

### 3. Componentes `src/components/home/*` — Mesma adaptacao de cores

Todos os componentes Home usam `text-white/*` e `bg-white/*` para o tema dark. Cada um sera atualizado:

- **GlassCard.tsx**: Sem mudanca (usa classes CSS)
- **HomeKPICard.tsx**: `text-white/*` -> `text-foreground/*`, `bg-white/10` -> `bg-primary/10`
- **DailySummary.tsx**: Textos, botoes de periodo, tooltip do sparkline
- **HealthScore.tsx**: Texto do score, labels dos fatores, gauge track
- **AlertsPanel.tsx**: Textos, icones de fundo, badges de prioridade
- **QuickLinks.tsx**: Labels, icones, hover states
- **TopCategories.tsx**: Labels, barras, percentuais
- **HomeEmptyState.tsx**: Textos, botoes CTA
- **HomeSkeletonLoading.tsx**: Cores dos skeletons (`bg-white/5` -> `bg-foreground/5`)

### 4. Cores semanticas mantidas

- `text-emerald-400` -> `text-emerald-600` (melhor contraste no claro)
- `text-red-400` -> `text-red-600`
- `text-amber-400` -> `text-amber-600`
- `text-blue-400` -> `text-blue-600`
- `text-purple-400` -> `text-purple-600`
- `text-orange-400` -> `text-orange-600`

---

## Resultado Visual Esperado

- Fundo branco/off-white com gradientes coloridos sutilissimos (mesh gradient)
- Cards de vidro branco translucido com bordas finas e sombras suaves
- Texto escuro com boa legibilidade
- Hover com elevacao sutil e borda mais visivel
- Efeito premium "frosted glass" sobre fundo claro — estilo Apple/Figma
- Totalmente harmonizado com o restante do projeto (sidebar branca, header branco)

