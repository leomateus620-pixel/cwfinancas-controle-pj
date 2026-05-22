## Objetivo

Reverter o tamanho/alinhamento do card 3D ao original (mesmo footprint do card de Dashboard antigo) e refinar o card "Criar demanda inteligente" para ficar premium, com alto contraste e foco no objetivo principal.

## Mudanças

### 1. `HeroMockCarousel.tsx` — voltar ao alinhamento original
- Remover o `px-2` aplicado em cada slide (`<div class="… px-2">`) — esse padding está encolhendo/reposicionando o card em relação à versão anterior.
- Remover o `mask-image` lateral do viewport (fade nas bordas) que está cortando/ampliando visualmente o card. Usar `overflow-hidden` simples.
- Manter `perspective`, autoplay (6,5s), pause no hover, dots, drag/swipe e respeito a `prefers-reduced-motion`.
- Resultado: o card 3D ocupa exatamente o mesmo espaço/alinhamento que o card Dashboard original tinha na home.

### 2. `MockDemandCard.tsx` — cortar a sidebar e focar no objetivo
- Remover por completo o bloco `<div class="w-56 border-r …">` (sidebar com menus + logo).
- O `<div class="flex min-h-[440px]">` vira `<div class="min-h-[440px]">` com `p-6` no conteúdo, ocupando 100% da largura interna.
- Aumentar protagonismo do header "Criar demanda inteligente":
  - Eyebrow `CENTRAL DE DEMANDAS` com `text-primary` saturado.
  - Título maior (`text-2xl`) e `font-bold tracking-tight`.
  - Subtítulo com `text-foreground/70` (em vez de `text-muted-foreground` que estava embaçado).
- Mini logo CW Finanças no canto superior direito do conteúdo (para não perder identidade após remover sidebar).

### 3. Contraste e legibilidade (polimento premium)
- Reduzir o overlay diagonal de "glare" (`opacity-60` → `opacity-25`) que estava lavando o conteúdo.
- Texto digitado (typewriter) passa de `text-foreground` translúcido para `text-foreground font-semibold` com `text-[12px]` (era `text-[11px]`).
- Labels "DESCRIÇÃO DA DEMANDA", "FLUXO DA DEMANDA": `text-foreground/60` + `font-bold` (não mais `text-muted-foreground` que sumia no glass).
- Chips interpretados: aumentar opacidade do fundo (`/12` → `/18`), borda (`/25` → `/45`), texto `font-bold`, `text-[11px]`.
- Stepper: textos "Preencher" / "Confirmação" em `text-foreground font-semibold`; "2/2 concluído" em verde mais saturado.
- CTA "Abrir minha demanda em segundos": aumentar sombra, garantir `text-white` puro e leve `text-shadow` para destacar.
- Card de confirmação inferior: texto em `text-foreground/80` (não muted) + título `text-foreground font-bold`.

### 4. `MockDashboardCard.tsx`
- Sem alterações funcionais. Apenas confirmar que o footprint (min-h, paddings) continua idêntico ao do `MockDemandCard` para que o carrossel não cause "salto" entre os slides.

## Arquivos editados
- `src/components/landing/HeroMockCarousel.tsx`
- `src/components/landing/MockDemandCard.tsx`

## Fora do escopo
- Nenhuma mudança em rotas, lógica, backend, ou na página real `/demandas/nova`. Apenas refinamento visual do mock e do carrossel da landing.