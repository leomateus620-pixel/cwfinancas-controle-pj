

## Fix: Espaço em branco no Hero Card do Dashboard

### Problema
Mesmo bug dos cards de Contas a Pagar/Receber: a regra CSS `.liquid-glass-card-hero > *` força `position: relative` nos orbes decorativos (linhas 37-38), fazendo-os ocupar espaço vertical e criando o grande espaço em branco visível na screenshot.

### Solução
Envolver os dois orbes decorativos do Hero Card em um único container com `style={{ position: 'absolute', inset: 0 }}` e `pointer-events-none`, exatamente como já foi feito nos cards de PayableCard e ReceivableCard.

### Arquivo: `src/pages/OverviewPage.tsx`

Linhas 36-38 — substituir os dois divs de orbes soltos por:

```tsx
{/* Decorative orbs - wrapped to bypass > * CSS rule */}
<div style={{ position: 'absolute', inset: 0 }} className="pointer-events-none overflow-visible">
  <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-primary/8 to-info/4 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
  <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-success/5 to-transparent rounded-full blur-2xl translate-y-1/4 -translate-x-1/4" />
</div>
```

Apenas 1 arquivo, 1 mudança cirúrgica.

