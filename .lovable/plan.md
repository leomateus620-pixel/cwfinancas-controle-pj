

## Reformulação Completa do Menu "Insights IA"

### Visão Geral

Redesign premium do módulo Insights IA com 4 cards executivos clicáveis no topo, expansão elegante com detalhes acionáveis, deep linking para transações/categorias/DRE, e camada de rastreabilidade. Visual Liquid Glass Premium consistente com o resto do dashboard. Nenhuma mudança no backend (Edge Function `ai-generate-insights` permanece intacta).

### Arquitetura de Componentes

```text
src/pages/InsightsPage.tsx           ← Header premium redesenhado + orquestra tudo
src/components/insights/
  ├── InsightsHeader.tsx             ← Header com chips de status + botões
  ├── InsightsSummaryGrid.tsx        ← Grid dos 4 cards principais
  ├── InsightCategoryCard.tsx        ← Card individual (Saúde/Riscos/Oportunidades/Anomalias)
  ├── InsightDetailPanel.tsx         ← Painel expandido ao clicar num card
  ├── InsightDetailItem.tsx          ← Item individual dentro do painel expandido
  ├── InsightTraceability.tsx        ← Bloco discreto de rastreabilidade
  ├── InsightsEmptyState.tsx         ← Empty state premium
  ├── InsightsSkeleton.tsx           ← Skeleton loading sofisticado
  ├── InsightCard.tsx                ← [mantido como fallback]
  ├── RiskCard.tsx                   ← [mantido como fallback]
  └── AIInsightsPanel.tsx            ← Refatorado: agora usa os novos componentes
```

### Mudanças Detalhadas

#### 1. `InsightsPage.tsx` — Header Premium
- Título "Insights com IA" + subtítulo "Leitura estratégica dos seus dados financeiros"
- Chips: transações analisadas, período, "Análise validada" com ícone CheckCircle
- Botões: "Atualizar Insights" e "Ver rastreabilidade dos dados"
- Visual: liquid-glass com blur suave, sem poluição

#### 2. `InsightsSummaryGrid.tsx` — Grid dos 4 Cards
- Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` com gap adequado
- Cada card mapeia uma seção da resposta da IA:
  - **Saúde Financeira** → `kpis` + `insights.summary` + `highlights[0]`
  - **Principais Riscos** → `insights.risks` (sorted by severity desc)
  - **Oportunidades** → `insights.opportunities`
  - **Anomalias** → `insights.anomalies`

#### 3. `InsightCategoryCard.tsx` — Card Individual
Props: `type`, `title`, `icon`, `summary`, `priority`, `metrics`, `onClick`, `isExpanded`
- Visual: `liquid-glass-card` com cores semânticas por tipo (success/warning/info/destructive)
- Mostra: título, ícone, resumo 1 frase, 1-2 métricas numéricas, badge de prioridade, CTA "Ver detalhes"
- Hover: translateY(-2px) + sombra premium
- Clique: alterna expansão do painel de detalhes

#### 4. `InsightDetailPanel.tsx` — Painel Expandido
- Usa `Collapsible` do Radix para animação suave
- Lista cada item do grupo com `InsightDetailItem`
- Visual: `liquid-glass-compact` aninhado, animação fade-in

#### 5. `InsightDetailItem.tsx` — Item Individual
- Título + evidência + impacto + recomendação
- Bloco de rastreabilidade discreto (collapse toggleável)
- **Deep links**: botões/links que navegam com query params:
  - `/expenses?category=Pró-labore` — filtro por categoria
  - `/income?category=Comissões` — filtro por categoria de receita  
  - `/expenses?search=texto` — busca por descrição
  - `/dre` — link direto para DRE
  - `/cash-flow` — link direto para fluxo de caixa
- Links gerados a partir de `category`, `type` e `description` presentes nos dados da IA

#### 6. `InsightTraceability.tsx` — Rastreabilidade
- Bloco discreto com: transações analisadas, período, categorias envolvidas, última atualização, fonte, modelo
- Toggle "Ver origem do insight" que expande detalhes
- Visual: texto xs, muted, border-top sutil

#### 7. `InsightsEmptyState.tsx` — Estado Vazio Premium
- Visual liquid-glass com ícone animado
- Texto claro: "Gerar Insights com IA" / "Dados insuficientes para gerar insight confiável"
- Botão CTA primário

#### 8. `InsightsSkeleton.tsx` — Loading
- 4 skeleton cards no grid + skeleton do header
- Shimmer animation suave

#### 9. `AIInsightsPanel.tsx` — Refatorado
- Agora é um orchestrator que usa os novos componentes
- Mantém a mesma interface (`useFinanceInsights` hook inalterado)
- Lógica de priorização: ordena insights por impacto, limita a 3 por categoria no card summary, restantes no painel expandido
- Tratamento de null/undefined/empty em cada seção

#### 10. Mapeamento dos Deep Links
Função helper `buildInsightLinks(insight)` que analisa o texto da evidência/título para extrair:
- Categorias mencionadas → link para `/expenses?category=X` ou `/income?category=X`
- Valores mencionados → link para transações filtradas
- Referências a DRE → link para `/dre`
- Referências a caixa → link para `/cash-flow`

Isso usa pattern matching simples nos textos retornados pela IA, sem necessidade de mudança no backend. O backend já retorna `category`, `type` e valores numéricos nas estruturas de `highlights`, `risks`, `opportunities` e `anomalies`.

#### 11. CSS — Novas Classes
Adicionar ao `index.css`:
- `.liquid-glass-insight-card` — variante para os 4 cards com cores por tipo
- `.liquid-glass-detail-panel` — já existe `liquid-glass-detail-card`, reutilizar

### O que NÃO muda
- Hook `useFinanceInsights.ts` — inalterado
- Edge Function `ai-generate-insights` — inalterada  
- Nenhuma mudança em banco de dados
- Nenhuma mudança em rotas
- Componentes existentes (`InsightCard.tsx`, `RiskCard.tsx`) mantidos mas não mais usados pelo painel principal

### Arquivos Criados/Modificados
- **Modificados**: `InsightsPage.tsx`, `AIInsightsPanel.tsx`, `src/index.css`
- **Criados**: `InsightsHeader.tsx`, `InsightsSummaryGrid.tsx`, `InsightCategoryCard.tsx`, `InsightDetailPanel.tsx`, `InsightDetailItem.tsx`, `InsightTraceability.tsx`, `InsightsEmptyState.tsx`, `InsightsSkeleton.tsx`

### Priorização de Insights (Lógica Frontend)
- Riscos `high` primeiro, depois `medium`, depois `low`
- Highlights com maior impacto numérico primeiro
- Deduplicação: se dois insights têm a mesma categoria, agrupar
- Máximo 3 itens visíveis por card, restantes no painel expandido
- Se `data_quality.coverage_pct < 80`, mostrar aviso de confiança baixa

