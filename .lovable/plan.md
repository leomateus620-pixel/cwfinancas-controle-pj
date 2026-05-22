
## Objetivo

Transformar o card 3D atual da landing page (`/`) num **carrossel horizontal de 2 cards 3D** de mesma proporção, mantendo o card existente 100% intacto e adicionando um novo card visual sobre a **Criar demanda inteligente**. O card inicial visível ao entrar na tela passa a ser o da Demanda Inteligente.

## Comportamento do carrossel

- **Cards (ordem de exibição):**
  1. `MockDemandCard` (novo) — visível por padrão ao carregar a página
  2. `MockDashboardCard` (atual, sem alteração visual)
- **Transições:**
  - **Automática:** troca a cada ~6s, com fade + slide horizontal suave (cubic-bezier, 700–900ms). Pausa quando o cursor está sobre o card, quando a aba perde o foco (`document.visibilitychange`) ou quando o usuário respeita `prefers-reduced-motion`.
  - **Manual por scroll/arrasto:** Embla Carousel (`embla-carousel-react` já instalado, ver `src/components/ui/carousel.tsx`) com `dragFree: false`, `loop: true`, `align: "center"`. Suporta swipe touch, drag mouse e scroll horizontal nativo no trackpad.
  - **Indicadores:** 2 dots minimalistas abaixo do card (estilo já presente no anexo), clicáveis para navegação direta. Sem botões prev/next intrusivos — opcionalmente setas discretas que aparecem apenas no hover do wrapper (desktop).
- **Performance:**
  - Renderização única dos cards (sem unmount entre slides) para preservar animações iniciais (chart SVG, fade-in-up).
  - Apenas `transform` + `opacity` animados (GPU). Sem layout thrash.
  - `will-change: transform` apenas durante transição (toggle via classe), removido depois.
  - Mantém `hidden lg:block` — o carrossel é desktop-only (igual ao card atual).

## Arquitetura de arquivos

```text
src/components/landing/
  HeroMockCarousel.tsx        (novo — wrapper Embla + autoplay + dots)
  MockDashboardCard.tsx       (novo — extrai o JSX atual das linhas 380–696 da LandingPage, sem mudança visual)
  MockDemandCard.tsx          (novo — card 3D da Demanda Inteligente)
src/pages/LandingPage.tsx     (substituir o bloco "Right Column – 3D Mock App Preview" pelo <HeroMockCarousel/>)
```

A extração do card atual para `MockDashboardCard.tsx` é puramente mecânica (mover JSX + imports relevantes: `logoFull`, `features`, constantes do chart, `Sparkles`, `ChevronRight`). Nenhum pixel muda.

## Design do novo `MockDemandCard`

Mesma "janela mac" com title bar (`cwfinancas.app/demandas`), mesma moldura `liquid-glass`, mesma rotação 3D base (`rotateY(-13deg) rotateX(7deg) rotateZ(-1deg)`), mesmo glow externo, mesmo glare diagonal. Conteúdo interno (mock da tela `Criar demanda inteligente`):

- **Sidebar idêntica** à do card atual (mesmos `features`) para continuidade visual, com o item **"Demandas"** destacado/selecionado (badge ativo em `primary`).
- **Área de conteúdo** (com `translateZ` em camadas, igual ao card atual):
  - Header: eyebrow "Central de Demandas" + título **"Criar demanda inteligente"** + linha fina "Descreva sua solicitação — a IA estrutura o resto".
  - **Card hero "Demanda"** (`liquid-glass-highlight`, translateZ 25px): ícone 3D `Sparkles`/`Send` à esquerda + textarea simulado com texto digitado em animação typewriter: *"Pagar fornecedor Acme — R$ 1.400,00, vencimento 25/05. NF em anexo."*
  - **Chips de interpretação automática** (fade-in escalonado após o typewriter, translateZ 20px): `Tipo: Pagamento`, `Valor: R$ 1.400,00`, `Vencimento: 25/05`, `Prioridade: Normal` — usando os mesmos tokens de cor já existentes (success/primary/warning).
  - **Mini-stepper de 2 etapas** (Preencher → Confirmação) já em estado "Concluído" no segundo passo, com check verde animado e barra de progresso 100%.
  - **CTA principal** (botão `liquid-glass` primary com seta): **"Abrir minha demanda em segundos →"** que linka para `/login?next=/demandas/nova` (mesmo destino do "Entrar"). Hover: glow primary + leve `translateZ`.
  - **Badge de confirmação** no rodapé (estilo do "Insight IA" atual): ícone `CheckCircle2` em verde + "Solicitação recebida com sucesso · enviada ao time CW".
- **Animações de entrada:** mesmo padrão `animate-fade-in-up` com delays escalonados (800–1800ms). Typewriter usa CSS `steps()` ou um pequeno hook com `requestAnimationFrame`, com `prefers-reduced-motion` mostrando o texto completo direto.

## Detalhes técnicos do carrossel

- **Lib:** Embla (`useEmblaCarousel`) — já no projeto, mais leve que reimplementar drag.
- **Plugin autoplay:** sem dependência nova; um `useEffect` com `setInterval(() => api.scrollNext(), 6000)` + `api.on("pointerDown", pause)` + `api.on("settle", scheduleNext)`.
- **Slide inicial:** `startIndex: 0` com a ordem `[Demand, Dashboard]` → Demanda aparece primeiro.
- **Tamanho:** cada `CarouselItem` ocupa `basis-full` do wrapper (largura idêntica à do card atual). Wrapper mantém `perspective: 1400px` no nível externo para não cortar a sombra 3D; `overflow-visible` no viewport com máscara lateral via `mask-image` gradient para suavizar a borda durante o slide.
- **Acessibilidade:** `role="region" aria-roledescription="carousel" aria-label="Prévia do produto"`, dots com `aria-label` ("Ver Demanda inteligente" / "Ver Dashboard"), respeito a `prefers-reduced-motion` desligando autoplay e reduzindo duração para 200ms.
- **Sem custo de re-render:** mocks são puramente apresentacionais (sem hooks de dados, sem fetch, sem context). O peso adicional é só CSS + um SVG simples — não afeta performance da landing.

## Garantias

- Card de Dashboard preservado byte-a-byte (extração JSX literal).
- Mobile (`<lg`) continua sem o card, igual hoje.
- Nenhuma alteração em rotas, auth, dados ou edge functions.
- Sem libs novas.
