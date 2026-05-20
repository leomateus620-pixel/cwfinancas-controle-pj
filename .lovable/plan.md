## Objetivo
Corrigir, **só no desktop**, a tela de sucesso da demanda: hoje o canal 3D se sobrepõe ao card de origem e ao logo CW, os checkpoints ficam minúsculos e desalinhados, o puck atravessa atrás do card e o conjunto parece "stepper de baixa resolução". Mobile já está bom e não será tocado.

## Diagnóstico (PC)
1. O retângulo do "canal/sulco" usa `inset-x-[5%]` e cobre origem **e** destino — vira fundo branco atrás do card.
2. Trilho em `inset-x-[10%]` + grid com colunas de larguras diferentes → os 3 nós não casam com início/fim do trilho.
3. Nós de 28px num viewport de 1087px viram "stepper genérico".
4. Logo CW em `size="md"` (~110px) é pequeno demais para ser o destino premium.
5. Puck viaja de `12% → 88%` da seção inteira → nasce atrás do card e morre dentro do logo.
6. `rotateX(22deg)` só no retângulo, sem perspectiva real no trilho/nós → sem profundidade.
7. `backdrop-blur` + `mix-blend-mode: screen` em camadas pequenas degradam a nitidez.

## Mudanças (apenas branch `hidden md:block` do `DemandFlowSection.tsx`)

### 1. Nova composição em 3 zonas com pedestais
```text
┌────────────┐    ┌───────────────────────────────┐    ┌────────────┐
│  ORIGEM    │ ─> │  CANAL 3D + 3 CHECKPOINTS     │ ─> │  NÚCLEO CW │
│ (pedestal) │    │  (puck viaja somente aqui)    │    │ (pedestal) │
└────────────┘    └───────────────────────────────┘    └────────────┘
```
- Grid `grid-cols-[280px_1fr_220px] gap-6`.
- Canal/sulco confinado à coluna central (`inset-x-0`), não cobre mais origem/destino.
- Origem e destino ganham pedestal próprio (gradiente radial no piso + sombra elíptica) para dar peso.

### 2. Perspectiva real
- Altura sobe de `180px` para `240px`.
- `perspective: 1600px`, `perspectiveOrigin: 50% 75%`.
- `transformStyle: preserve-3d` na coluna central; piso com `rotateX(28deg)`.
- Reflexo dos nós no piso (cópia `scaleY(-1)`, opacity 0.18, mask gradiente).

### 3. Checkpoints premium (não stepper)
- Nó passa para `w-12 h-12` (≈48px) no desktop via prop `size` opcional.
- Disco glass duplo: anel externo translúcido + disco interno gradiente azul.
- Sombra elíptica projetada no piso por baixo de cada nó.
- `passing`: ring expansivo maior + spark vertical curto.
- `upcoming`: borda azul mais saturada + check com leve emissão.

### 4. Trilho alinhado aos centros
- Reescrito como **SVG path** dentro da coluna central, com `linearGradient` no stroke e `filter: drop-shadow` para o glow.
- Sparks viajam ao longo do mesmo eixo do path (mesma `inset` que os nós).

### 5. Puck reposicionado
- Trajetória `8% → 92%` **dentro da coluna central** (não mais da seção inteira).
- Tamanho +20%, leve `rotateX` para casar com o piso inclinado.
- Halo do puck mais largo e menos opaco.

### 6. Núcleo CW maior no desktop
- `CWLogoDestination` passa a receber `size="lg"` quando `md+`.
- Adiciono pedestal radial igual ao da origem.
- Removo `backdrop-blur-xl` do disco principal (estava degradando o PNG do logo).

### 7. Nitidez
- Sparks: 3–4px, sem `blur`, glow via `box-shadow`; removido `mix-blend-mode: screen` (fica só no halo do puck).
- `will-change: transform, opacity` nos elementos animados (layer próprio do compositor).

## Arquivos
- **Editado:** `src/components/demands/new/success/DemandFlowSection.tsx` (somente branch desktop).
- **Editado (mínimo, via prop opcional `size`):** `src/components/demands/new/success/FlowStationCard.tsx` para suportar nó maior no desktop sem afetar mobile.
- **Sem alteração de API:** `CWLogoDestination.tsx` (já aceita `size="lg"`), `DemandOriginCard.tsx`.

## Não muda
- Mobile (`md:hidden`).
- Tempos/lógica de animação (`PASS_AT`, `ARRIVED_AT`, `SETTLE_AT`, `passingIdx`, `arrived`, `settled`).
- Backend, dados, hooks, rotas, fluxo de criação de demanda.

## Resultado esperado
- Card de origem **fora** do canal, como ponto de partida claro.
- Canal 3D real com piso inclinado e reflexo dos nós.
- 3 checkpoints grandes, glass, perfeitamente alinhados ao trilho.
- Puck visível atravessando o canal de ponta a ponta.
- Logo CW grande, valorizada, pousada num pedestal.
- Renderização nítida — fim do aspecto "borrado/baixa resolução".
