
# Plano — Card "Insights Premium" com Chip de IA + Veias Pulsantes

## O que muda

Apenas o **slide "Insights Premium"** do carrossel `HighlightsCarousel` em `src/pages/LandingPage.tsx` ganha uma representação visual completamente nova no lugar do ícone estático `Sparkles`. Os outros 5 slides continuam usando o layout atual com ícone Lucide (preserva consistência do carrossel).

A nova cena ocupa o mesmo "slot" do ícone (área 56x56), mas se expande visualmente para preencher o card inteiro com uma rede de veias sutis ao fundo, mantendo o título/descrição/badge "Novo" intactos à direita.

## Conceito visual

Inspiração: um coração anatômico, traduzido em linguagem fintech/IA.

```text
   ╭─ veias finas saem do chip e se ramificam ─╮
   │   ·  ·    ·          ·   ·                │
   │     \   /    chip    \  /                 │
   │      \ /  ┌────────┐  \/                  │
   │   ────●───│  IA ✦  │───●────              │
   │      / \  │ pulsa  │  /\                  │
   │     /   \ └────────┘ /  \                 │
   │   ·    ·    ·     ·    · ·                │
   ╰─ pulsos de luz percorrem cada veia ──────╯
```

- **Chip central**: quadrado arredondado com gradiente rosa→magenta (mantém o `accent` `hsl(330 81% 60%)` do slide), pinos laterais como num CI real, símbolo `✦` no centro. Ele **pulsa** com sístole/diástole (ritmo ~70bpm).
- **Veias**: 6–8 paths SVG saindo do chip em direções variadas, com curvas Bézier orgânicas (não retas), ramificando-se em "capilares" mais finos nas pontas. Stroke fino com gradiente do accent.
- **Pulsos de luz**: pequenos círculos brilhantes que percorrem cada veia do chip até a ponta, sincronizados com o batimento. Quando o chip "bate" (sístole), N novos pulsos são emitidos; eles viajam pela veia com easing acelerado (física: como sangue jorrando), desbotam ao chegar.
- **Glow ambiente**: o chip emite uma onda de luz radial a cada batimento (igual ECG), que se expande e desbota.
- **Partículas atmosféricas**: 4–5 pontos de luz flutuando sutilmente no fundo do card, dão profundidade.

## Física aplicada (sem libs externas)

Tudo feito com `requestAnimationFrame` + matemática simples:

- **Batimento cardíaco**: ciclo de 850ms (≈70bpm) com curva dupla — uma sístole forte (escala chip 1.0 → 1.12 em 120ms com spring overshoot) seguida de uma sístole secundária menor (1.0 → 1.05) e diástole longa (relax). Implementado como soma de dois pulsos Gaussianos no tempo.
- **Pulsos nas veias**: cada veia tem `pathLength` medido via `getTotalLength()`. A cada sístole, 1 pulso é injetado em cada veia com `progress = 0`. Ele avança com `velocity = base + jitter`, sofre desaceleração leve (drag) para simular resistência, e some quando `progress > 1`. Posição calculada com `path.getPointAtLength(progress * length)`.
- **Brilho do chip**: intensidade do glow segue a derivada do batimento (mais intenso no momento da sístole), criando a sensação de "energia liberada".
- **Onda de choque**: a cada sístole nasce um anel SVG no centro com `r=8 → 60` em 600ms, opacidade `0.6 → 0`, easing `ease-out`.
- Tudo é **frame-based via rAF** — performático, sem CSS animations conflitantes, pausa quando o slide não está ativo (economia de CPU).

## Implementação técnica

### Arquivo novo

**`src/components/landing/AIChipPulse.tsx`** — componente isolado, props mínimas:
```ts
interface AIChipPulseProps {
  accent: string;       // ex: "hsl(330 81% 60%)"
  active: boolean;      // pausa rAF quando false (slide não visível)
}
```

Estrutura interna:
- `<svg viewBox="0 0 320 120">` ocupando o lado esquerdo do card (substitui o quadrado 56x56 do ícone, expande para ~140x110 com overflow visível para as veias se estenderem por baixo do texto sem competir).
- Refs para cada `<path>` das veias para chamar `getTotalLength()` / `getPointAtLength()`.
- Estado de pulsos guardado em `useRef<Pulse[]>` (não em state — evita re-renders por frame); aplicação direta via `ref.current.setAttribute('cx', ...)`.
- `useEffect` inicia o `rAF`, limpa no unmount ou quando `active=false`.
- `prefers-reduced-motion`: respeitado — quando ativo, mostra cena estática (chip + veias sem pulsos).

### Edição em `LandingPage.tsx`

1. Importar `AIChipPulse`.
2. Adicionar campo opcional `customVisual?: 'ai-chip'` no objeto do slide "Insights Premium".
3. No render do carrossel, condicionalmente: se `h.customVisual === 'ai-chip'`, renderizar `<AIChipPulse accent={h.accent} active={!isTransitioning} />` no lugar do bloco do ícone, com layout ajustado (a cena ocupa ~40% da largura do card, texto fica à direita). Os outros slides continuam idênticos.
4. Aumentar levemente o `min-h` do card para acomodar a cena (de 120px para ~140px) — isso afeta todos os slides igualmente para evitar saltos de layout durante a transição.

### Detalhes visuais

- Veias: `<linearGradient>` SVG do accent (opacidade 0.7 perto do chip → 0.1 nas pontas), `stroke-width: 1.5px`, `stroke-linecap: round`, `filter: blur(0.3px)` para suavidade orgânica.
- Pulsos: círculos `r=2.5` com `fill` branco luminoso + `filter: drop-shadow(0 0 6px accent)`; trail simulado renderizando 3 círculos por pulso em posições escalonadas com opacidade decrescente.
- Chip: `<rect>` 32×32 arredondado com gradiente, 4 "perninhas" (rect 4×2) em cada lado, símbolo central `<text>✦</text>` ou ícone `Sparkles` SVG inline.
- Cor de fundo das veias passa a transparente para se misturar com o `liquid-glass-compact` existente.

## Não muda

- Estrutura geral do carrossel, dots de navegação, auto-advance, pausar no hover.
- Outros 5 slides (DRE, Previsões, Cartão, Conversor, Dados Protegidos).
- Estilo do título "Insights Premium", descrição e badge "Novo".
- Paleta accent rosa do slide.

## Validação

- Verificar visualmente o carrossel girando (passar pelo slide "Insights Premium" e voltar).
- Confirmar que a animação **pausa** quando o slide não está visível (`active=false`) para não desperdiçar CPU.
- Testar `prefers-reduced-motion` (cena estática).
- Garantir que o card mantém boa legibilidade do texto à direita (veias não devem invadir a área do texto com opacidade alta).
