

## Plano: Resumo Executivo no topo dos Insights

Adicionar o `insights.summary` como um parágrafo destacado entre o header e os 4 cards, dentro de `AIInsightsPanel.tsx`.

### Mudança

**`src/components/insights/AIInsightsPanel.tsx`** — Inserir um bloco visual entre `<InsightTraceability>` e `<InsightsSummaryGrid>`:

```tsx
{/* Executive Summary */}
<div className="liquid-glass-card p-6 md:p-8 border-l-4 border-primary/30">
  <p className="text-sm md:text-base text-foreground/90 leading-relaxed font-medium">
    {insights.summary}
  </p>
</div>
```

O bloco usa `liquid-glass-card` consistente com o visual existente, com uma borda lateral de destaque (`border-l-4 border-primary/30`) para diferenciar visualmente como um resumo executivo. Nenhum outro arquivo precisa ser modificado.

