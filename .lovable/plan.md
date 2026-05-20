
# Refatoração da tela de sucesso da criação de demanda

Escopo estritamente visual. Nenhuma alteração em hooks, RLS, Supabase, Asana, payload ou fluxo de envio. Mudanças apenas em `src/components/demands/new/success/*`.

## Problema atual

Hoje `DemandSuccessExperience.tsx` renderiza, de cima para baixo:
1. `DemandMiniCard` (solto, no topo)
2. `DemandJourneyTunnel3D` (grande, ocupando largura cheia)
3. `DemandSuccessSummaryCard` (mensagem de agradecimento)

Isso quebra a hierarquia: o efeito visual vira protagonista e a mensagem fica em segundo plano, sem conexão visual entre os blocos.

## Nova composição

Um único bloco central (card principal Liquid Glass, max-w ~720px), com a seguinte ordem interna:

```text
┌─────────────────────────────────────────────┐
│ ✓  Solicitação recebida com sucesso         │  ← SuccessMainCard (header)
│    Obrigado pela solicitação. A equipe...   │
│                                             │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐ │
│ │Código│Status│ Tipo │Empr. │Solic.│Próx. │ │  ← DemandSummaryBlock
│ └──────┴──────┴──────┴──────┴──────┴──────┘ │
│ Resumo: pagamento de R$ X para fornecedor Y │
│                                             │
│ ─────────── fluxo de encaminhamento ─────── │
│                                             │
│  [Sua    ]→[Recebida]→[Análise]→[Equipe]→🟦 │  ← DemandFlowSection
│  [demanda]                              CW  │     (horizontal desktop)
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ [Acompanhar] [Nova demanda] [Voltar]        │  ← SuccessActionButtons
└─────────────────────────────────────────────┘
```

No mobile o fluxo vira vertical compacto: `Sua demanda ↓ Recebida ↓ Análise ↓ Equipe CW ↓ Logo CW`, com cards menores.

## Arquivos a alterar / criar

**Reescrever (visual apenas):**
- `src/components/demands/new/success/DemandSuccessExperience.tsx` — orquestra um único card principal contendo tudo, em vez de 3 blocos soltos.
- `src/components/demands/new/success/DemandSuccessSummaryCard.tsx` — vira `SuccessMainCard` (header de agradecimento + container do bloco inteiro). Mantém a assinatura/props existente para não quebrar imports; renderiza children.
- `src/components/demands/new/success/DemandJourneyTunnel3D.tsx` — substituído por `DemandFlowSection` mais refinado e menor (altura ~140px desktop / vertical compacto mobile), com cards intermediários reagindo à passagem da demanda.
- `src/components/demands/new/success/CWLogoDestination.tsx` — logo maior, com pulse/glow spring no momento da chegada.
- `src/components/demands/new/success/DemandMiniCard.tsx` — versão reduzida usada como ponto de origem do fluxo (não mais como hero no topo).
- `src/components/demands/new/success/SuccessActionButtons.tsx` — mantém os 3 botões, só ajusta espaçamento dentro do card.

**Criar:**
- `src/components/demands/new/success/SuccessMainCard.tsx` — wrapper Liquid Glass com header (ícone check, título, subtítulo).
- `src/components/demands/new/success/DemandSummaryBlock.tsx` — grid de metadados (Código, Status, Tipo, Empresa, Solicitante, Próximo passo) + linha de "Resumo".
- `src/components/demands/new/success/DemandFlowSection.tsx` — orquestra mini card → estações intermediárias → logo CW, com animação Framer Motion.
- `src/components/demands/new/success/FlowStationCard.tsx` — cards intermediários ("Recebida", "Em análise", "Equipe CW") que reagem quando a demanda passa (pulse + glow + check sutil).

## Detalhes da animação (Framer Motion)

Sequência ~2.2s, respeitando `useReducedMotion`:

1. `SuccessMainCard` — fade + translateY(12→0), 0.35s easeOut.
2. `DemandSummaryBlock` — stagger children 0.04s, fade in.
3. `DemandFlowSection` aparece (opacity + scale 0.98→1).
4. `DemandMiniCard` surge à esquerda com spring leve.
5. Um "puck" (clone do mini card em escala reduzida) percorre o fluxo via `motion` com `transform: translateX + translateZ` e `perspective: 1000px` no container — spring `{ stiffness: 80, damping: 18 }`.
6. Ao cruzar cada `FlowStationCard`, dispara variant `active` na estação: scale 1→1.06, border-glow, check fade-in. Controlado por `useAnimate` + delays escalonados (origem 0.6s, estação 1 ~1.0s, estação 2 ~1.35s, estação 3 ~1.7s, chegada ~2.0s).
7. `CWLogoDestination` recebe spring pulse (scale 1→1.08→1) + halo glow ao "receber" o puck.
8. Texto discreto "Encaminhada para análise" aparece abaixo do fluxo (fade 0.3s).

Reduced motion: sem puck em movimento, sem pulses; estações já aparecem em estado `active` e logo CW em estado final. Layout idêntico.

## Layout & responsividade

- Desktop (≥768px): card principal `max-w-3xl mx-auto`. Fluxo em linha horizontal, altura controlada (~160px), cards intermediários ~80px largura. Perspectiva CSS leve (`perspective: 1000px`, `rotateY` mínimo nos cards laterais para sensação 3D).
- Tablet/Mobile (<768px): fluxo vertical, cards full-width compactos (~56px altura), puck desce verticalmente. Logo CW centralizada e maior (h-16). Botões empilhados full-width.
- Testar em 360 / 390 / 430 / 1087 / 1440 via browser tools antes de finalizar.

## Texto final padrão

- Título: "Solicitação recebida com sucesso"
- Subtítulo: "Obrigado pela solicitação. A equipe da CW Finanças irá analisar sua demanda de {resumo} e dará andamento o mais breve possível."
- Rodapé do card: "Você pode acompanhar o andamento pela Central de Demandas."
- Campos no grid: Código, Status (badge "Em análise"), Tipo, Empresa, Solicitante, Próximo passo ("Triagem pela equipe CW"), Resumo.

`buildDemandSummary.ts` já existe e é reaproveitado sem alteração.

## O que NÃO muda

- `NewDemandPage.tsx`: continua chamando `<DemandSuccessExperience demandId={createdId} form={form} onNew={...} />`.
- `useDemand`, `useCreateDemand`, integração Asana, RLS, migrations — intocados.
- Props públicas de `DemandSuccessExperience` e `SuccessActionButtons` permanecem.

## Critério de aceite

Validar visualmente no preview (desktop 1087px + mobile 390px) após implementação:
- card principal é o foco e contém todos os blocos;
- fluxo aparece abaixo da mensagem, menor e proporcional;
- mini card, estações e logo CW alinhados no mesmo eixo;
- puck percorre o fluxo e estações reagem em sequência;
- logo CW destacada com pulse final;
- botões dentro do card, alinhados;
- mobile sem quebra, animação leve;
- reduced-motion mostra versão estática limpa.
