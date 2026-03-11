

## Plano: Tela de Apresentação dos Insights IA (Pre-Generate Screen)

### Conceito

Inspirado na imagem de referência, criar uma tela de apresentação premium antes da geração dos insights. O design usa um card escuro com preview de gráfico mockado, badge "AI" flutuante, gradientes vibrantes (laranja/roxo/azul) e texto persuasivo — tudo adaptado ao contexto financeiro do CW Finanças.

### Design

- **Card escuro central** (`bg-slate-900/95`) com bordas arredondadas e backdrop-blur, contendo:
  - Um mini gráfico decorativo (barras estilizadas em CSS/SVG) com barra de progresso laranja no topo — representando análise financeira
  - Badge **"AI"** flutuante no canto inferior esquerdo do card, com fundo gradiente (azul→primary)
  - Três dots animados abaixo do badge (indicando processamento)
- **Título forte**: "Análise financeira inteligente com IA"
- **Descrição**: "Identifique padrões, riscos e oportunidades nos seus dados financeiros. Receitas, despesas, tendências e anomalias em mais de X transações."
- **Botão CTA** grande e arredondado para gerar
- **Gradiente decorativo** sutil no fundo (laranja→roxo→azul) nas bordas do card, similar à imagem
- **Features list**: 3 mini-items com ícones (Riscos, Oportunidades, Anomalias)

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/components/insights/InsightsEmptyState.tsx` | Redesign completo com layout inspirado na imagem de referência |

