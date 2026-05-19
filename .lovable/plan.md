# Redesign Premium — Módulo "Demandas Financeiras"

Vou refatorar **apenas o módulo Demandas** (sidebar entry, dashboard, lista, nova demanda, detalhe, aprovações, documentos, configurações) elevando para o padrão **3D Liquid Glass** já presente em outras áreas (Home, Cartão de Crédito), sem inventar uma nova identidade visual e sem quebrar lógica de negócio existente (Asana, RLS, hooks, pg_cron).

## Escopo

### 1. Sistema de design local (sem tocar tokens globais)
- Criar `src/components/demands/ui/`:
  - `LiquidGlassCard.tsx` — wrapper reutilizando classes `.liquid-glass*` do `index.css`, com variantes `default | highlight | navy | compact`, orbs opcionais (padrão wrapper `absolute pointer-events-none` — regra do projeto), prop `interactive` (hover lift sutil + press scale).
  - `ThreeDIconCard.tsx` — caixinha com gradiente radial, borda translúcida, ícone Lucide centrado, sombra interna, suporte a cor temática por tipo de demanda.
  - `DemandTypeIcon.tsx` — mapa tipo → ícone Lucide + gradiente (pagamento, recebimento, NF, boleto, conciliação, reembolso, outro, urgente, aprovação, asana).
  - `MetricTile.tsx` — KPI 3D: ícone 3D, número (`tabular-nums` JetBrains Mono), label, micro-trend sparkline opcional, hover elevation.
  - `MotionFade.tsx` / `StaggeredList.tsx` — wrappers framer-motion (já instalado) com easing natural `[0.22, 1, 0.36, 1]`, duração 300-400ms, respeita `prefers-reduced-motion`.
- **Não criar tokens novos no `index.css`** — reaproveitar `--primary`, `--glass-*`, classes `.liquid-glass*` existentes.

### 2. Sidebar — entrada "Demandas"
Editar `src/components/layout/AppSidebar.tsx`:
- Manter estrutura/rota.
- Ícone do grupo passa a usar `DemandTypeIcon` (3D mini) no anchor.
- Item ativo ganha visual liquid-glass (borda translúcida + sombra interna) via classe condicional, alinhado ao restante.
- Badges de contagem: já existe `badgeKey: "pending"`. Adicionar `urgent` e `asana_error` lendo do hook `useDemandsInbox` (contadores agregados já existentes ou query leve nova `useDemandSidebarBadges`).
- Transição de abertura/fechamento de submenu com `AnimatePresence` (sem mudar comportamento do Radix Collapsible).

### 3. Dashboard (`DemandsDashboardPage.tsx`)
Reescrever layout mantendo hooks/dados atuais:
- **Header premium**: título + subtítulo + filtro de período (reuso do componente global, se aplicável) em `LiquidGlassCard highlight`.
- **6 KPIs principais** em grid 3×2 (desktop) / 1 col (mobile) usando `MetricTile`:
  1. Demandas no período
  2. Aguardando aprovação
  3. Tempo médio de resolução
  4. Volume financeiro finalizado
  5. Demandas urgentes
  6. Demandas com erro no Asana
  - Cada tile é clicável e navega para `/demands?status=...` (filtros já suportados).
- **Linha secundária**: gráfico de evolução (Recharts já no projeto) + lista "Gargalos / Vencidas" + "Aguardando aprovação".
- **Skeleton states** premium (shimmer já existente nas classes).

### 4. Lista Recebidas (`DemandsListPage.tsx`)
- Manter toda lógica (`useDemandsInbox` infinite, filtros, KPIs, Kanban, Asana sync).
- Apenas reskin: cards de KPI passam a `MetricTile`; barra de filtros em `LiquidGlassCard compact`; toolbar (view toggle tabela/cards/kanban + Sincronizar Asana) com botões glass.
- **Mobile**: o `Sheet` de filtros já existe — refinar header e botão "Filtros (N)" com glass-chip.
- Empty state premium: ilustração 3D + botões "Nova demanda" / "Criar demanda de teste" / "Configurar Asana".
- Cards view e Kanban cards: novo `DemandCard` (glass + AsanaChip + Prio/Status badges + SLA).

### 5. Nova Demanda — "Criar demanda inteligente" (`NewDemandPage.tsx`)
Refatoração de UX em 4 etapas com formulário adaptativo:
- **Stepper** glass no topo (Tipo → Informações → Documento → Revisão), com progress animado.
- **Etapa 1 — Tipo**: grid de `ThreeDIconCard` selecionáveis (7 tipos), hover lift, seleção com borda glow.
- **Etapa 2 — Informações principais**: campos dinâmicos por tipo via `SmartDemandForm` (novo) com schema Zod por tipo:
  - pagamento, recebimento, nf, boleto, conciliacao, reembolso, outro (campos exatos do briefing).
  - Máscaras: BRL, CNPJ/CPF (reusar utilitários existentes em `src/lib`); calendário shadcn; sugestão de categoria/prioridade via regra simples client-side (sem IA on-row — regra do projeto).
- **Etapa 3 — Documentos**: `UploadDropzone` novo (drag-and-drop, click, colar imagem via `paste` event, câmera no mobile via `<input capture>`). Cards de arquivo com prévia, status, remover/substituir. Placeholders preparados para campos OCR futuros (valor, vencimento, CNPJ, fornecedor, confiança, needs_review) — apenas UI, sem chamadas.
- **Etapa 4 — Revisão**: `DemandReviewPanel` (resumo lateral consolidado) + aviso sobre criação automática no Asana + botões Voltar / Salvar rascunho / Enviar.
- **Tela de sucesso** (novo `DemandCreatedScreen`): código da demanda, status inicial, `AsanaChip` em tempo real (polling curto 3×), botões "Ver demanda" / "Criar nova".
- **Desktop**: form esquerda + resumo lateral direita. **Mobile**: etapas full-screen + botões fixos no rodapé.

### 6. Detalhe (`DemandDetailPage.tsx`)
- Manter abas já implementadas (Visão geral, Documentos, Comentários, Checklist, Timeline, Asana Logs) e `DemandAsanaActions`.
- Reskin header em `LiquidGlassCard highlight` com `DemandTypeIcon` 3D, badges e SLA chip.
- Tabs: estilo glass com indicador animado (`layoutId` do framer-motion — permitido aqui, já usado em outras telas).
- **Mobile**: tabs com scroll horizontal + drawer full-screen.

### 7. Aprovações, Documentos, Configurações
- `DemandsApprovalsPage`, `DemandsDocumentsPage`, `DemandsSettingsPage`, `AsanaSettingsPage`: apenas reskin (cards passam a `LiquidGlassCard`, empty states padronizados, botões glass). **Sem mudança funcional.**

### 8. Performance e qualidade
- `React.memo` em `DemandCard`, `MetricTile`, itens de Kanban.
- Lazy-load das páginas pesadas via `React.lazy` nas rotas (`App.tsx`) — Dashboard, Aprovações, Documentos, AsanaSettings.
- Animações respeitam `prefers-reduced-motion`.
- Sem novos blurs pesados — reuso das classes existentes (24–32px já no padrão).
- Skeletons em todas as queries (loading/error/success — regra core do projeto).

### 9. Acessibilidade / responsividade
- Testar visualmente em 360 / 390 / 430 / tablet / desktop após implementação (browser tool).
- Contraste mantido (tokens HSL existentes).
- `aria-label` em ícones decorativos.

## Arquivos

**Novos**
- `src/components/demands/ui/LiquidGlassCard.tsx`
- `src/components/demands/ui/ThreeDIconCard.tsx`
- `src/components/demands/ui/DemandTypeIcon.tsx`
- `src/components/demands/ui/MetricTile.tsx`
- `src/components/demands/ui/MotionFade.tsx`
- `src/components/demands/DemandCard.tsx`
- `src/components/demands/new/StepIndicator.tsx`
- `src/components/demands/new/DemandTypeSelector.tsx`
- `src/components/demands/new/SmartDemandForm.tsx`
- `src/components/demands/new/UploadDropzone.tsx`
- `src/components/demands/new/DemandReviewPanel.tsx`
- `src/components/demands/new/DemandCreatedScreen.tsx`
- `src/hooks/useDemandSidebarBadges.ts`

**Editados (reskin + integração)**
- `src/components/layout/AppSidebar.tsx`
- `src/pages/demands/DemandsDashboardPage.tsx`
- `src/pages/demands/DemandsListPage.tsx`
- `src/pages/demands/NewDemandPage.tsx`
- `src/pages/demands/DemandDetailPage.tsx`
- `src/pages/demands/DemandsApprovalsPage.tsx`
- `src/pages/demands/DemandsDocumentsPage.tsx`
- `src/pages/demands/DemandsSettingsPage.tsx`
- `src/pages/demands/AsanaSettingsPage.tsx`
- `src/App.tsx` (lazy imports)

## Não escopo (intencional)
- Sem alterações em `supabase/migrations`, edge functions, RLS, pg_cron, schema.
- Sem novos tokens globais em `index.css`.
- Sem mudança nos hooks de dados (`useDemandsInbox`, `useDemand`, `useDemandQuickActions`, `useAsanaSettings`, `useAsanaSyncLogs`, `useFinancialDemands`) — apenas consumo.
- Sem OCR real — apenas UI preparada.

## Validação
Após implementação: navegar preview em 390px e desktop, validar empty states, criar demanda de exemplo, conferir Asana chip, abrir detalhe, arrastar no Kanban. Reportar print + checklist do item 15 do briefing.
