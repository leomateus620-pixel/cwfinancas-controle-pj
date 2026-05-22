## Ajustes de alinhamento e refinamento do glow "liquid glass 3D" — Landing Page

### 1. Reequilíbrio do grid (espaço respirando à esquerda)

**Arquivo:** `src/pages/LandingPage.tsx`

O grid atual usa `lg:grid-cols-[1fr_1.1fr]` com `gap-12`, o que faz a coluna direita (carrossel 3D) "comer" o espaço da coluna esquerda no viewport ~1160px. Vamos:

- Trocar a proporção para `lg:grid-cols-[1.05fr_1fr]` (texto ganha leve folga, mock 3D não estoura).
- Aumentar `gap` em desktop para `lg:gap-16 xl:gap-20`.
- Adicionar `lg:pl-4 xl:pl-8` na coluna direita (`<HeroMockCarousel />` envolto em `<div>`), empurrando o mock para a direita sem aumentar seu tamanho.
- Garantir `max-w-[560px]` no card 3D dentro de `HeroMockCarousel` para impedir crescimento no `1.1fr` antigo.

Resultado: o card 3D desliza ~32–48px à direita; o bloco "Gestão Financeira Inteligente / Cartão de Crédito" deixa de ficar espremido.

### 2. Reformular o "blur azul" → Liquid Glass 3D com física real

**Arquivo:** `src/components/landing/HeroMockCarousel.tsx`

O glow atual (`absolute -inset-12 rounded-[40px] opacity-40 blur-3xl`) gera aquele halo azul lavado que o usuário rejeitou. Vamos substituir por uma estrutura em camadas inspirada em vidro real (refração + caustics + ground reflection):

**Camada A — Caustic floor (chão refrativo)**
Elipse fina, baixa, abaixo do card (`bottom: -8%`, `height: 18%`), com gradiente radial multicolor (primary + teal + violet) e `filter: blur(40px) saturate(140%)`. Simula a luz que atravessa o vidro e bate no piso.

**Camada B — Side fresnel (borda de refração lateral)**
Dois gradientes verticais finos posicionados nas bordas esquerda/direita do card (largura ~6%), com `mix-blend-mode: screen` e cor `hsl(199 89% 65% / 0.35)`. Dão o efeito de luz contornando vidro espesso.

**Camada C — Atmospheric haze (em vez do orb difuso azul)**
Manter um único radial sutil atrás (`opacity: 0.18`, não 0.40), mas com gradiente **conico** em vez de radial puro, usando 3 stops (teal → primary → violet) e `blur(60px)`. Isso quebra a monotonia "azul lavado".

**Camada D — Specular highlight (brilho do topo do vidro)**
Faixa horizontal de ~2px no topo do card (já existe parcialmente), reforçada via `box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.4)` no próprio mock, mais um pseudo-arco `before:` curvo no topo.

**Camada E — Contact shadow (sombra de contato físico)**
Sombra escura, curta e nítida logo abaixo do card (`height: 8px`, `blur: 12px`, `opacity: 0.35`), separada da sombra difusa profunda — dá ancoragem ao "objeto sobre superfície".

Todas as camadas vivem em um wrapper `pointer-events-none` (padrão do projeto, conforme memory `glass-card-orbs-pattern`). A transição entre slides (`selected`) reorquestra apenas a tonalidade dos stops (demand = teal/primary, dashboard = primary/violet), não a estrutura — evita reflows.

### 3. Polimento secundário

- Trocar o `bg` translúcido azul de fundo do glow por gradientes em hsl que reutilizam tokens do design system (`--primary`, `hsl(173 80% 40%)`, `hsl(262 83% 58%)`).
- Adicionar `will-change: filter, opacity` apenas nas camadas animadas (transição 700ms).
- Respeitar `prefers-reduced-motion`: desabilitar a transição da camada C.

### Arquivos editados
- `src/pages/LandingPage.tsx` (grid proportions, gap, padding direito)
- `src/components/landing/HeroMockCarousel.tsx` (remoção do blur azul antigo, novas camadas A–E, max-width do card)

### Fora de escopo
- Nenhuma mudança em `MockDemandCard.tsx`, `MockDashboardCard.tsx`, conteúdo dos cards, animações internas, autoplay, dots ou rotas.
- Sem alterações de backend, dados ou business logic.
