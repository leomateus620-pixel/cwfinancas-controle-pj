## Diagnóstico (PC, 1087px)

Olhando o screenshot atual, os problemas são todos da branch desktop do `DemandFlowSection.tsx`:

1. **Canal "flutuando" abaixo dos cards** — o piso usa `rotateX(28deg)` num retângulo de 140px posicionado em `top-1/2`. Como origem e destino estão em colunas separadas e mais altas, o piso vira uma "pílula branca" solta no meio, desconectada de tudo.
2. **Checkpoints amontoados** — `justify-evenly` + `px-[6%]` em coluna 1fr + nós de 48px (`size="lg"`) + labels "Recebida / Triagem / Equipe CW" sem espaço → os 3 ficam colados no centro, com labels se tocando.
3. **Origem encolhida à esquerda** — coluna de 280px fixos, card com largura natural ~220px, sobrando ar à esquerda e dando sensação de desalinhamento.
4. **Logo CW deslocada à direita** — mesma coisa na coluna de 220px; e o "halo verde" do logo invade o canal porque não há respiro.
5. **Trilho SVG some atrás do piso** — z-index do piso > trilho; o usuário vê só a pílula branca, não a linha de luz.
6. **Puck "8% → 92%" da coluna central** começa atrás do card de origem (porque a coluna central encosta nele) e termina dentro do logo.
7. **Eixos verticais diferentes** — card de origem está centralizado verticalmente, mas o piso/trilho/checkpoints também, e como o card é mais alto que os nós, visualmente fica tudo em alturas diferentes.

Resumindo: a composição em 3 zonas foi na direção certa, mas as proporções, o eixo vertical comum e o tratamento do "piso" ficaram errados.

## Objetivo do polimento

Uma única faixa horizontal coesa, onde:
- card de origem, canal e logo CW dividem o **mesmo eixo vertical**;
- o "piso 3D" passa por baixo das **três zonas** (não só do meio), unindo tudo;
- os 3 checkpoints ficam bem espaçados, com labels respiráveis;
- o puck atravessa visivelmente da origem até o logo;
- nenhum elemento "flutua" solto.

Mobile (`md:hidden`) não é tocado.

## Mudanças (somente `DemandFlowSection.tsx`, branch `hidden md:block`)

### 1. Piso 3D contínuo cobrindo toda a faixa
Em vez de o piso viver dentro da coluna central, ele passa a ser **uma camada `absolute inset-0`** do contêiner desktop, atrás de tudo. Assim a origem e o logo "pousam" no mesmo piso e o canal deixa de parecer uma pílula isolada.

```text
┌──────────────────────────────────────────────────────────────┐
│  piso 3D inclinado (rotateX 22deg), gradiente único          │
│  ┌─────────┐        ●────●────●        ┌─────────┐           │
│  │ ORIGEM  │  ════════════════════════ │  CW     │           │
│  └─────────┘                           └─────────┘           │
└──────────────────────────────────────────────────────────────┘
```

- Piso: `absolute inset-x-[2%] top-[58%] h-[120px] rounded-[32px]`, `rotateX(22deg)` (mais sutil que 28), gradiente vertical bem suave, borda 1px branca, sombra elíptica única por baixo.
- Atmosfera azul: uma só, larga, cobrindo toda a faixa (não mais limitada à coluna central).

### 2. Grid rebalanceado e eixo vertical comum
- `grid-cols-[260px_1fr_200px]` → `grid-cols-[1fr_1.6fr_1fr]` com `max-w` controlado nas colunas laterais, para o conjunto respirar igual nos dois lados.
- Altura da seção: `h-[220px]` (em vez de 240) e `items-center` em todas as colunas.
- Origem e logo CW recebem `justify-self: end` / `justify-self: start` para "encostarem" nas bordas do canal — fim do ar morto.

### 3. Trilho na frente do piso, alinhado aos nós
- `z-index`: piso (0) < trilho SVG (1) < sparks (2) < checkpoints (3) < puck (4).
- Trilho desenhado em SVG `viewBox="0 0 100 100"` ocupando **a coluna central inteira**, com `x1=0 x2=100` e mesmos `inset` dos nós (calculados via `flex justify-between` com padding fixo 12%, não `justify-evenly`).
- Sparks viajam exatamente sobre o trilho (mesma `top`).

### 4. Checkpoints respiráveis
- Trocar `justify-evenly px-[6%]` por `flex justify-between px-[12%]` → os 3 pontos ficam: 12%, 50%, 88% da coluna central, alinhados ao trilho.
- Labels: `text-[11px]`, `min-w-[72px]`, `text-center`, `tracking-tight`, `whitespace-nowrap` → "Recebida", "Triagem", "Equipe CW" deixam de se tocar.
- Sombra elíptica do nó projetada **no mesmo piso global** (mesma cor/blur), não em sombras isoladas por nó.

### 5. Puck atravessando a faixa inteira
- Trajetória do puck volta a ser da seção inteira: `left: 4% → 96%`, **mas com `top` fixo na altura do trilho** (que agora é a mesma altura do centro do card de origem e do disco do logo).
- Assim ele nasce visivelmente saindo do card, passa pelos 3 checkpoints e pousa no logo CW — leitura única, sem cortes.

### 6. Origem e logo no mesmo eixo
- Card de origem: vertical center exato com o trilho (ajustar `align-items` do contêiner para usar o `top` do trilho como referência via `translateY`).
- Logo CW: idem, e remover o "halo verde" expandido (`size="lg"` aceita um `compact` visual) ou reduzir a opacidade do ring externo do logo no desktop, para não invadir o canal.

### 7. Pedestais simplificados
- Remover os 2 pedestais elípticos individuais (origem e CW). Eles ficam redundantes porque o **piso global já é o pedestal**. Isso elimina as 2 "manchas escuras" que aparecem soltas no screenshot.

### 8. Nitidez
- Reduzir `blur` do piso para 0 (gradiente puro), manter blur só na sombra inferior.
- Manter `will-change: transform, opacity` nos animados.
- Manter `mixBlendMode: screen` somente no halo do puck.

## Arquivos
- **Editado:** `src/components/demands/new/success/DemandFlowSection.tsx` (apenas branch `hidden md:block` + leve ajuste de z-index na raiz).
- **Sem alteração:** `FlowStationCard.tsx`, `CWLogoDestination.tsx`, `DemandOriginCard.tsx`, mobile, lógica de animação, timers, backend.

## Não muda
- Branch `md:hidden` (mobile).
- Timing `PASS_AT / ARRIVED_AT / SETTLE_AT`, `passingIdx`, `arrived`, `settled`.
- Nenhum hook, rota, dado ou edge function.

## Resultado esperado no desktop
- Uma faixa única, com origem encostada à esquerda do canal e logo CW encostada à direita.
- Piso 3D contínuo unindo tudo — fim da "pílula branca solta".
- 3 checkpoints bem espaçados (12% / 50% / 88%), labels legíveis e sem colisão.
- Trilho de luz visível atrás dos nós, sparks correndo sobre ele.
- Puck atravessando a faixa inteira, do card ao logo, no mesmo eixo vertical.
- Sensação de peça única, alinhada e polida — não mais "stepper desmontado".
