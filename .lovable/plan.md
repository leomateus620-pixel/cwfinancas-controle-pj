

## Plano: Melhorar visual do ComparisonBar "vs mês anterior"

### Problema
O card "vs mês anterior" está com visual pobre — texto pequeno demais (`text-[10px]`), baixo contraste (`text-foreground/35`), e layout horizontal comprimido com classe `liquid-glass-chip` genérica.

### Solução
Redesenhar o `ComparisonBar` com estética Liquid Glass Premium:

**Arquivo: `src/components/home/CaixaAtualCard.tsx`** (linhas 97-127)

1. **Container**: Trocar `liquid-glass-chip` por um card glass com backdrop-blur, borda luminosa sutil e padding maior
2. **Layout**: Reorganizar em layout com label à esquerda e valores à direita, mais respiração
3. **Tipografia**: Aumentar de `text-[10px]` para `text-xs` no label e `text-sm` nos valores, melhorar contraste
4. **Badge de variação**: Aumentar tamanho, adicionar ícone com mais destaque, border sutil glass
5. **Valores comparativos**: Fonte `text-xs` com seta estilizada entre os valores, melhor legibilidade
6. **Cores**: Manter verde/vermelho semântico mas com tons mais vibrantes e fundo glass translúcido

```text
ANTES: [vs mês anterior  ↑ -22.8%  R$ 86,3 mil → R$ 74,3 mil]  (tudo inline, 10px)

DEPOIS:
┌─────────────────────────────────────────────────┐
│  vs mês anterior                                │
│  ┌──────────┐                                   │
│  │ ↓ -22.8% │   R$ 86,3 mil  →  R$ 74,3 mil    │
│  └──────────┘                                   │
└─────────────────────────────────────────────────┘
  (glass card, 12-13px text, backdrop-blur, luminous border)
```

