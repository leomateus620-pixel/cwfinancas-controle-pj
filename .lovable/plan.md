## Resumo

Refinar **apenas** o início e o fim do fluxo "Criar demanda inteligente". Não tocar no formulário por tipo, no `useCreateDemand`, na integração com Asana, nem em RLS.

## Pontos-chave de contexto que afetam o desenho

- O login dos clientes é **compartilhado** (um único usuário `cwfinancas` atende todos). Portanto a identificação **não pode** ser persistida no `profile` do usuário (como faz hoje o `ClientIdentityGate`). Ela vira uma **etapa do fluxo**, salva **por demanda**.
- A tabela `financial_demands` não tem colunas `requester_*`. Adicionar **uma única coluna aditiva** `requester_metadata jsonb` (sem quebrar nada existente).
- Não existe `framer-motion` no projeto. Adicionar via `bun add framer-motion` para alimentar a animação 3D do túnel (com fallback de `prefers-reduced-motion`).
- O atual `SuccessScreen` (final do `NewDemandPage.tsx`) será substituído pelo novo componente `DemandSuccessExperience`.

## Etapas do plano

### 1. Migration aditiva
Nova coluna em `financial_demands`:
- `requester_metadata jsonb default '{}'::jsonb` (nullable).
Sem mexer em RLS, triggers ou outras colunas. Sem dropar nada.

### 2. Estado e payload do formulário
- Estender `DemandFormState` (em `SmartDemandForm.tsx`) com `requester_name`, `requester_company`, `requester_email`, `requester_phone`, `requester_role` (strings, default `""`).
- Em `buildDemandPayload`, montar `requester_metadata = { name, company, email, phone, role }` (somente chaves preenchidas) e adicionar ao payload retornado.
- Estender `CreateDemandInput` em `useDemand.ts` com `requester_metadata?: Record<string, string> | null` e passar adiante no `insert`. Asana segue intocado (fire-and-forget como hoje).

### 3. Nova etapa "Identificação" (passo 0)
- **Remover** o gate antigo (`ClientIdentityGate` que escreve no profile global) do `NewDemandPage`. O componente fica no codebase mas deixa de ser usado aqui.
- Novo `src/components/demands/new/DemandRequesterStep.tsx`:
  - Card central Liquid Glass, ícone 3D discreto (`UserCircle2` + glow), 5 campos: nome (obrigatório), empresa (obrigatório), e‑mail, whatsapp, cargo/setor.
  - Validação `zod` na transição para o próximo passo (nome ≥ 2, empresa ≥ 2, e‑mail formato se preenchido, whatsapp dígitos se preenchido, todos ≤ 120 chars).
  - Pré-preenche apenas se algum campo já estiver no `form` (ex.: voltar etapa). Não busca dados do profile.
  - Texto de apoio exato da spec.
- Atualizar `STEPS` em `NewDemandPage.tsx` para `["Identificação", "Tipo", "Informações", "Documentos", "Revisão"]`.
- Lógica `next()` adiciona validação para `step === 0`.
- `SummarySidebar` mostra também `Solicitante` e `Empresa` quando preenchidos.
- Ajustar `StepIndicator` — já é proporcional, só receber 5 itens.

### 4. Tela final — `DemandSuccessExperience`
Substituir `SuccessScreen` por `src/components/demands/new/DemandSuccessExperience.tsx`, organizado em 3 áreas + componentes auxiliares:

```
src/components/demands/new/success/
  DemandSuccessExperience.tsx     # orquestra a sequência de animação
  DemandMiniCard.tsx              # mini card flutuante da demanda
  DemandJourneyTunnel3D.tsx       # túnel 3D + card percorrendo
  CWLogoDestination.tsx           # logo CW com spring de chegada
  DemandSuccessSummaryCard.tsx    # card grande de agradecimento
  SuccessActionButtons.tsx        # 3 botões finais
  buildDemandSummary.ts           # helper que monta o resumo dinâmico por tipo
```

#### Sequência (framer-motion, total 1.6–2.4s)
1. Mini card entra (opacity 0→1, y −20→0, 280ms).
2. Túnel aparece (scale 0.96→1, opacity 0→1, 360ms).
3. Réplica reduzida do card atravessa o túnel (x/y/scale com `perspective(900px)`, easing `[0.22, 1, 0.36, 1]`, 900ms).
4. Logo CW recebe o card com spring leve (stiffness 220, damping 18, 380ms) + glow azul/verde suave.
5. Card de agradecimento fade-in + slide-up (320ms).

#### Túnel 3D
- Container com `perspective: 1000px` e `transform-style: preserve-3d`.
- 6–8 "anéis" `border` posicionados com `translateZ()` decrescente para criar profundidade.
- Glow controlado: 1 gradiente cônico suave + 2 orbs `blur-3xl` (azul/emerald), sem partículas.
- Sombra 3D do card via box-shadow em camadas (`0_24px_60px_-20px`).

#### `prefers-reduced-motion`
- Detectar via `useReducedMotion()` do framer-motion.
- Se ativo: pular animações, mostrar diretamente mini card + logo + card final estáticos com mesmas dimensões.

#### Mobile
- Túnel vira coluna vertical (logo embaixo do mini card). 
- Anéis reduzidos para 4. Animação encurtada para ~1.2s.
- Botões em coluna full‑width.

### 5. Card final (`DemandSuccessSummaryCard`)
- Texto principal: **"Obrigado pela solicitação."**
- Texto secundário gerado por `buildDemandSummary(form)` cobrindo todos os tipos da spec (pagamento, recebimento, nota_fiscal, boleto, conciliacao, reembolso, outro) com fallback genérico.
- Mostra: código (`demand_code` via `useDemand(id)`), status "Recebida", solicitante, empresa, tipo, resumo curto, próximo passo "Análise da equipe CW", linha "Você pode acompanhar pela Central de Demandas."
- Chip Asana **só** se não estiver com erro: `pending_sync` → "Solicitação registrada. A equipe será notificada automaticamente."; `synced` → "Encaminhada para a equipe." Nunca exibir erro técnico.

### 6. Botões finais (`SuccessActionButtons`)
- **Acompanhar demanda** → `Link` para `/demands/:id`.
- **Criar nova demanda** → reseta `form`, `files`, `createdId`, volta para `step = 0` (Identificação).
- **Voltar para a central** → navega para `/demands` (rota da Central existente).

### 7. Dependências
- `bun add framer-motion`

## Arquivos afetados

**Novos**
- `src/components/demands/new/DemandRequesterStep.tsx`
- `src/components/demands/new/success/DemandSuccessExperience.tsx`
- `src/components/demands/new/success/DemandMiniCard.tsx`
- `src/components/demands/new/success/DemandJourneyTunnel3D.tsx`
- `src/components/demands/new/success/CWLogoDestination.tsx`
- `src/components/demands/new/success/DemandSuccessSummaryCard.tsx`
- `src/components/demands/new/success/SuccessActionButtons.tsx`
- `src/components/demands/new/success/buildDemandSummary.ts`

**Editados**
- `src/pages/demands/NewDemandPage.tsx` — novo step 0, novo `STEPS`, troca `SuccessScreen` por `DemandSuccessExperience`, remove uso do `ClientIdentityGate`.
- `src/components/demands/new/SmartDemandForm.tsx` — extensão de `DemandFormState`, `EMPTY_FORM`, `buildDemandPayload`.
- `src/hooks/useDemand.ts` — `CreateDemandInput` ganha `requester_metadata`.
- `package.json` — adiciona `framer-motion`.

**Migration**
- `financial_demands.requester_metadata jsonb default '{}'::jsonb`.

## O que NÃO mudará
- `SmartDemandForm` por tipo permanece exatamente igual (só o tipo do state cresce).
- `useCreateDemand`, fluxo Asana, RLS, `company_id`, hooks de inbox/list, telas existentes.
- `ClientIdentityGate` (não usado mais aqui, mantido para evitar quebrar imports caso reativem no futuro).
- Stepper/visual existente — só recebe um item extra.

## Critérios de aceite
- Abrir `/demands/new` mostra **Identificação** como passo 1.
- Nome e empresa obrigatórios bloqueiam o "Próximo".
- Os 5 campos chegam em `financial_demands.requester_metadata`.
- Submit cria a demanda (qualquer tipo) sem regressão.
- Após sucesso, aparece `DemandSuccessExperience` com mini card, túnel 3D, logo CW e card de agradecimento com texto dinâmico por tipo.
- `prefers-reduced-motion` ativo exibe versão estática.
- Mobile (360/390/430) sem quebras; botões full-width.
- Asana segue em background; nenhum erro técnico do Asana é exibido ao cliente nesta tela.