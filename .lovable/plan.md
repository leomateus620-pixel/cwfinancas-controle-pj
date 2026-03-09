

## Plano: Liquid Glass nos KPI Cards + Tagline com cores da logo

### Mudanças em `src/components/FinanceIntroAnimation.tsx`

**1. KPI Pills com estilo Liquid Glass**
- Substituir o estilo atual dos cards (`bg-white/5 border border-white/10 backdrop-blur-sm`) por um design liquid glass texturizado:
  - `backdrop-blur-xl` (24px)
  - Borda luminosa com `border-white/15`
  - Background com gradiente translúcido `bg-gradient-to-br from-white/10 to-white/5`
  - `::before` pseudo-element com noise texture (via inline style ou classe utilitária)
  - Sombra suave com glow sutil baseado na cor do card (emerald para receita, red para despesas, blue para lucro)
  - Border-radius maior (`rounded-2xl`)
  - Padding mais generoso

**2. Tagline "Controle Financeiro Inteligente" com cores da logo**
- A logo CW PJ usa azul institucional (primary ~`hsl(221 85% 53%)`) e teal/cyan como cores principais
- Aplicar um gradiente de texto (`bg-clip-text text-transparent`) usando as cores da logo: azul (`#2563eb`) → teal (`#14b8a6`)
- Aumentar levemente o font-weight para `font-medium`

### Arquivo modificado
- `src/components/FinanceIntroAnimation.tsx`

