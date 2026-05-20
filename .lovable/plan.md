
# Tela de sucesso “Fluxo CW Premium” — refatoração definitiva

Refatoração estritamente visual em `src/components/demands/new/success/*` e ajuste fino de copy/botões para cliente. Nada de hook, RLS, Supabase, Asana ou payload é tocado.

## Diagnóstico

O `DemandFlowSection` atual virou um stepper genérico: cards quadrados conectados por uma linha azul, divisor solto "Encaminhamento", logo CW pequena, sem profundidade real nem hierarquia premium. O efeito briga visualmente com o card de agradecimento em vez de complementá-lo.

Além disso: o cliente ainda vê texto "Você pode acompanhar o andamento pela Central de Demandas" e tem como destino o detalhe da demanda — isso precisa sumir para `role = cliente`.

## Nova composição (Fluxo CW Premium)

```text
┌──────────────────────────────────────────────────────────┐
│ ✓ Solicitação recebida com sucesso                       │
│   Obrigado pela solicitação. A equipe da CW Finanças     │
│   irá analisar sua demanda de {resumo}...                │
│                                                          │
│ ┌─Código─┬─Status─┬─Tipo─┬─Empresa─┬─Solic.─┬─Próximo─┐  │
│ │ ...    │  ...   │ ...  │  ...    │  ...   │  ...    │  │
│ └────────┴────────┴──────┴─────────┴────────┴─────────┘  │
│ Resumo: ...                                              │
│                                                          │
│   ╭─────────── trilha 3D (canal premium) ──────────╮     │
│   │ ▣ Sua    ·•·•·•·•·•·•·•·•·•·•·•·•·•·•   ╔════╗ │     │
│   │   demanda  Recebida   Triagem   Equipe   ║ CW ║ │     │
│   │                                          ╚════╝ │     │
│   ╰────────────────────────────────────────────────╯     │
│         Encaminhada para análise da equipe CW            │
│                                                          │
│ [Criar nova demanda]    [Voltar ao início]               │
└──────────────────────────────────────────────────────────┘
```

A trilha vira uma **peça única** (não cards soltos). Visual de canal/rail glass curvo, com profundidade real:

- **Base do rail**: faixa horizontal com `perspective: 1400px` + `rotateX(18deg)` aplicado no container interno → o canal "tomba" para o fundo, criando piso/teto em fuga.
- **Paredes do canal**: dois gradientes laterais (`linear-gradient` translúcidos com `mask-image`) sugerem que o rail está dentro de um sulco.
- **Trilho principal**: linha central com gradiente azul→ciano→branco com brilho interno (`box-shadow inset`) e linhas finas paralelas acima/abaixo para reforçar a perspectiva (linhas guia tipo "track").
- **Marcadores de checkpoint** (Recebida · Triagem · Equipe CW): NÃO são cards quadrados ligados por linha. São **nós discretos** sobre o trilho — círculo glass 28px com ícone minimalista 14px dentro, label compacto 10px abaixo. Sem borda destacada por padrão. Quando o puck cruza: pulse spring, anel azul preenche o nó, label ganha contraste e um check muito sutil aparece à direita do label (sem virar verde berrante).
- **Pontos de luz** discretos viajando no trilho em loop (3–4 sparks pequenos com `mix-blend-mode: screen` e `filter: drop-shadow`).

## Mini card da demanda (DemandOriginCard)

Posicionado à esquerda da trilha, levemente para fora dela (sai do "cliente" e entra no canal):

- Liquid Glass premium, raio 16px, 3D leve (`rotateY: 8deg` em repouso, `rotateY: 0` quando entra)
- Topo: cápsula pequena com label "SUA DEMANDA" em uppercase 9px tracking
- Ícone 3D do tipo (reaproveita `DemandTypeIcon` em `size="md"` com sombra interna)
- Linha 1: tipo da demanda (ex.: "Reembolso") em font-semibold 13px
- Linha 2: código curto em mono tabular 11px
- Mini badge de prioridade no canto (cápsula 9px com cor por prioridade)
- Sombra dupla: `0 14px 30px -10px rgba(15,23,42,0.20), 0 0 0 1px rgba(255,255,255,0.6) inset`
- Entrada: `spring stiffness 180 damping 22`, fade + translateX(-12 → 0) + rotateY(8 → 0)

## Núcleo CW (CWDestinationNode)

Refazer o `CWLogoDestination` como um "núcleo" — não mais um discoplano:

- Orbe glass maior (h-24 → h-28 no desktop), formato circular com **dupla camada**: anel externo translúcido (radial gradient azul→emerald 18% opacity, blur 14px) + disco interno glass nítido com a logo CW grande e centralizada
- Borda gradiente cônica sutil (conic-gradient passando por azul-ciano-emerald-azul, opacity 35%) animada em rotação lenta (loop 18s, infinito)
- Sombra projetada no "chão" do canal (elipse blur abaixo do orbe, opacity 30%)
- Estado `arrived`: spring `scale [1, 1.08, 1]`, halo verde-azulado pulsa uma vez, ring expansivo elegante (já existia, refinar)
- Label "CW Finanças" pequeno abaixo do núcleo, font-semibold 11px tracking, cor `text-foreground/75`

## Animação física (Framer Motion)

Total ~2.4s, respeita `useReducedMotion`:

| t (ms) | evento |
|-------|--------|
| 0     | Card principal e resumo já visíveis (fade do card pai) |
| 200   | Mini card surge à esquerda (spring) |
| 400   | Rail aparece com fade + scaleY(0.6 → 1) |
| 700   | Puck (clone reduzido do mini card) destaca do origem e entra no canal — `translateZ` 30 → 0, `rotateY` oscilando ±10° |
| 950   | Cruza checkpoint "Recebida" → pulse + anel azul + label acende (NÃO fica verde permanente, fica `current` se quiser, mas a paleta agora é azul para checkpoints intermediários e verde só na confirmação final) |
| 1300  | Cruza "Triagem" → pulse + anel azul |
| 1650  | Cruza "Equipe CW" → pulse + anel azul mais intenso (mais próximo do núcleo) |
| 1950  | Puck mergulha no núcleo CW (`scale` 0.55, `opacity` 0, `translateZ` 40) |
| 2000  | Núcleo CW pulsa + halo verde-azul + ring expansivo |
| 2200  | Texto "Encaminhada para análise da equipe CW" faz fade-up abaixo do trilho |

Springs: `{ type: "spring", stiffness: 60, damping: 18, mass: 0.9 }` no puck; `{ stiffness: 240, damping: 16 }` nos checkpoints e núcleo.

**Reduced motion**: estado final estático — mini card à esquerda, checkpoints todos em estado neutro com indicação textual, núcleo CW destacado, texto de confirmação visível. Sem puck, sparks ou rotações.

## Composição responsiva

**Desktop ≥768px**: trilha horizontal, `max-w` da composição = ~92% do card pai. Grid `[origem 140px] [rail flex-1] [núcleo 120px]` em uma linha, altura ~180px do bloco do canal.

**Mobile <768px**: vira **rail vertical compacto**:

```text
   [Mini card da demanda]
            │
       ▾ Recebida
            │
       ▾ Triagem
            │
       ▾ Equipe CW
            │
        ╔══════╗
        ║  CW  ║
        ╚══════╝
   Encaminhada para análise
```

- Largura full do card, padding lateral 12px
- Linha vertical central com gradiente azul→emerald e pontos de luz descendo
- Checkpoints: pequenos chips horizontais (ícone 12px + label 11px) à esquerda da linha
- Núcleo CW centralizado, tamanho `h-20 w-20`
- Sem rotações 3D agressivas no mobile (apenas `perspective` leve, sem `rotateX` no rail para evitar amassar layout)
- Animação simplificada: puck desce em vez de atravessar lateralmente

Validar em 360 / 390 / 430 / 768 / 1087 / 1440.

## Texto e botões (correção crítica para cliente)

Card principal:

- Título: **"Solicitação recebida com sucesso"**
- Mensagem: **"Obrigado pela solicitação. A equipe da CW Finanças irá analisar sua demanda de {resumo curto} e dará andamento o mais breve possível."**
- Complemento (substitui o atual "Você pode acompanhar..."): **"Caso seja necessário complementar alguma informação, a equipe da CW entrará em contato."**

**Botões para `role = cliente` (sem admin/manager)**:
1. **Criar nova demanda** (primário, reinicia o fluxo via `onNew`)
2. **Voltar ao início** (outline, navega para `/demands/new`)

Remover para cliente: "Acompanhar demanda", qualquer link de detalhe, qualquer menção a "Central de Demandas". Já existe lógica em `SuccessActionButtons` que separa cliente puro; basta atualizar o conjunto de botões (hoje é Criar nova demanda + Sair → vira Criar nova demanda + Voltar ao início).

**Botões para admin/manager**: mantém os 3 atuais (Acompanhar demanda, Criar nova demanda, Voltar para a Central).

## Arquivos

**Reescrever:**
- `src/components/demands/new/success/DemandSuccessExperience.tsx` — composição final, ordem (header → resumo → CWPremiumFlow → ações), copy do complemento ajustada, sem o "Você pode acompanhar...".
- `src/components/demands/new/success/DemandFlowSection.tsx` → renomear conceitualmente para `CWPremiumFlow.tsx`: nova trilha 3D em canal, marcadores discretos como nós (não cards), pontos de luz, animação atualizada.
- `src/components/demands/new/success/FlowStationCard.tsx` → vira `FlowCheckpoint.tsx`: nós circulares pequenos sobre o trilho com label abaixo, paleta azul (não verde) para passagem, sem virar cards verdes berrantes.
- `src/components/demands/new/success/CWLogoDestination.tsx` → reforço como "núcleo CW": orbe duplo, conic-gradient ring lento, sombra no chão.
- `src/components/demands/new/success/SuccessActionButtons.tsx` → cliente puro recebe "Criar nova demanda" + "Voltar ao início" (não mais "Sair"). Admin/manager mantém os 3 botões.

**Criar:**
- `src/components/demands/new/success/DemandOriginCard.tsx` — mini card 3D da demanda (origem do fluxo).

**Manter sem alterar:**
- `buildDemandSummary.ts`
- `useUserRole`, `useDemand`, `useCreateDemand`, todo o backend
- `NewDemandPage.tsx` (continua chamando `<DemandSuccessExperience demandId form onNew />`)

## Critério de aceite

Validar visualmente no preview (desktop 1087px + mobile 390px) após implementação:

1. Não parece mais um stepper — é uma peça única com perspectiva real.
2. Card principal continua sendo o foco; o fluxo aparece DEPOIS do resumo.
3. Mini card da demanda parece físico (3D real, sombra dupla, badge).
4. Trilha tem perspectiva, paredes do canal, pontos de luz se movendo.
5. Checkpoints são nós discretos sobre o trilho, NÃO cards quadrados verdes.
6. Puck atravessa o canal com `translateZ`/`rotateY` visíveis.
7. Núcleo CW é claramente o destino — orbe duplo, conic ring, halo na chegada.
8. Cliente puro vê apenas "Criar nova demanda" + "Voltar ao início" — sem menção a Central nem detalhe.
9. Admin/manager continua vendo os 3 botões originais.
10. Mobile vertical sem overflow, animação leve, logo CW destacada.
11. `prefers-reduced-motion`: versão estática limpa e premium.
12. Nada do backend, hooks ou Supabase foi tocado.
