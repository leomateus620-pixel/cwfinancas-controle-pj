
# Correção da faixa de fluxo 3D na tela de sucesso

Escopo estritamente visual em `src/components/demands/new/success/*`. Sem mexer em hooks, RLS, Supabase, Asana ou payload.

## Problemas observados (print do usuário)

1. **Cores erradas**: "Em análise" e "Equipe CW" estão verdes com check ✓, como se já tivessem sido concluídas. Só "Recebida" deveria ficar verde — as outras ainda não aconteceram.
2. **Animação estática**: o "puck" e a perspectiva 3D não estão visíveis. Falta a sensação de luz percorrendo um túnel, profundidade real e física.

## 1. Corrigir semântica dos estados das estações

Hoje `FlowStationCard` tem só dois estados (`active` true/false) e quando `active=true` vira verde com check. Como o efeito dispara nas 3 estações em sequência, todas terminam verdes.

**Novo modelo de estados** (em `FlowStationCard.tsx`):

- `pending` — estado inicial neutro (cinza, ícone original)
- `passing` — momento em que o puck está cruzando (glow azul/branco pulsante, ícone original ainda, leve scale)
- `current` — a estação onde a demanda PAROU (apenas "Recebida" no fim da animação): verde suave com check
- `upcoming` — estações futuras já reveladas mas ainda não atingidas ("Em análise", "Equipe CW"): tom neutro com leve borda azul translúcida, ícone original, SEM check, SEM verde

Trocar a prop `active: boolean` por `state: "pending" | "passing" | "current" | "upcoming"`.

**Sequência final correta** após a animação:

```text
[Sua demanda] → [Recebida ✓ verde] → [Em análise · neutro] → [Equipe CW · neutro] → [Logo CW destacada]
```

O puck passa pelas 3 estações dando um flash `passing` em cada, mas só "Recebida" termina em `current` (verde + check). As outras voltam para `upcoming`.

Em `DemandFlowSection.tsx`, ajustar o controle de estado: em vez de `activeIdx` cumulativo, usar `passingIdx` (qual estação o puck está cruzando agora, dura ~250ms) + `settledIdx = 0` fixo no fim (só "Recebida" fica verde).

## 2. Efeito real de túnel 3D com luz passando

Reformular `DemandFlowSection.tsx` para entregar a sensação de luz atravessando um túnel:

**Container 3D real:**
- `perspective: 1200px`, `perspectiveOrigin: 50% 50%`, `transformStyle: preserve-3d` em todo o eixo do fluxo
- Cards das estações com `rotateY` sutil dependendo da posição (laterais inclinados ~6–10°, centro 0°) para criar paredes do túnel
- Wrapper interno com leve `rotateX(2deg)` para dar chão/teto

**Trilha de luz (tunnel beam) — múltiplas camadas:**
- Camada 1: linha base de gradiente azul→ciano com `box-shadow` interno suave
- Camada 2: **feixe de luz** (`motion.div`) percorrendo o eixo X com `translateZ` oscilando entre -20 e +20px, largura ~120px, gradiente radial branco-azulado, `mix-blend-mode: screen`, `filter: blur(8px)`. Loop suave 2.6s ease-in-out
- Camada 3: partículas/sparkles (3–5 `motion.div` pequenos) viajando em offsets aleatórios no eixo, com z variável, opacidade pulsando — sensação de poeira de luz
- Camada 4: halo glow que acompanha o puck (`motion.div` posicionado junto, blur 20px, escala respirando)

**Puck (demanda viajando):**
- Atualmente já existe mas sem profundidade percebida. Reforçar:
  - `translateZ` animado de +40px → 0 → +40px (entra, passa rente, sai) → sensação de profundidade
  - `rotateY` oscilando ±12° conforme posição
  - `scale` 1.05 → 0.92 → 0.55 (perspectiva natural)
  - `boxShadow` dinâmico com glow azul que intensifica no meio do trajeto
  - Trail/rastro: 2 cópias defasadas em 80ms e 160ms com opacidade decrescente (motion ghosts)
- Spring real: `transition: { type: "spring", stiffness: 55, damping: 16, mass: 0.9 }` em vez de `ease` puro

**Reação ao puck cruzar uma estação:**
- Dispara `passingIdx = i` por ~280ms → card recebe glow azul pulsante + leve `translateZ(-6px)` (afundar/empurrar) + borda brilhante
- Depois volta para `upcoming` (ou `current` se for a estação 0 "Recebida")

**Ambient:**
- Adicionar `motion.div` de "neblina" no fundo (gradient radial muito sutil) oscilando opacidade 0.4→0.7 em loop 4s para reforçar atmosfera

## 3. Reduced motion

Mantém respeito a `useReducedMotion`:
- Sem feixe de luz animado, sem partículas, sem puck em movimento
- Estado final estático: "Recebida" verde com check, "Em análise" e "Equipe CW" neutras, logo CW destacada, texto "Encaminhada para análise" visível

## 4. Mobile (<md)

Aplicar o mesmo modelo de estados (só "Recebida" verde no fim). O túnel vertical mantém versão simplificada do feixe descendo (translateY + translateZ animados). Sem partículas no mobile para preservar performance.

## Arquivos afetados

- `src/components/demands/new/success/FlowStationCard.tsx` — trocar `active: boolean` por `state: "pending" | "passing" | "current" | "upcoming"`, estilos por estado.
- `src/components/demands/new/success/DemandFlowSection.tsx` — reescrever animação: container com perspective real, feixe de luz multi-camada, partículas, puck com translateZ + rotateY + spring + trail, controle de `passingIdx` + `settledIdx=0`.

Nenhum outro arquivo é tocado.

## Critério de aceite

- Após a animação, apenas "Recebida" fica verde com check. "Em análise" e "Equipe CW" permanecem neutras (cinza/azul translúcido, ícone original).
- Visualmente perceptível: feixe de luz atravessa a trilha, partículas viajam, puck tem profundidade (parece avançar e recuar no eixo Z), cards reagem quando o puck passa (não ficam verdes).
- Logo CW pulsa ao receber o puck.
- Em `prefers-reduced-motion`, estado final é o mesmo (só "Recebida" verde).
- Mobile sem travamento, com versão simplificada do túnel.
