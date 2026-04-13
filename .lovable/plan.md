

## Plano: Mini KPIs em cards Liquid Glass dedicados com identidade por banco

### Problema atual

Os 4 indicadores (Fatura Líquida, Despesas Brutas, Reembolsos, Lançamentos) estão soltos como texto simples dentro do header — sem separação visual, sem profundidade, sem contraste adequado com os dados.

### Solução

Cada KPI ganha seu próprio card `liquid-glass` com:
1. **Ícone em cápsula colorida** — círculo translúcido com a cor do KPI (azul, vermelho, verde, sky) como fundo, ícone branco dentro
2. **Label em texto muted** + **valor em destaque bold** com hierarquia clara
3. **Borda lateral sutil** com a cor accent do banco (via `brand.glowColors[0]`) para unificar com a identidade da planilha
4. **Orbe decorativo micro** — um glow sutil no canto do card usando a cor do banco, criando o efeito Liquid Glass adaptado
5. **Grid responsivo** — `grid-cols-2 sm:grid-cols-4` com `gap-3` para alinhamento consistente

### Mudanças

**Arquivo: `src/components/credit-card/CreditCardConnectedHeader.tsx`**

- Refatorar `MiniKPI` para renderizar dentro de um container `liquid-glass rounded-xl` com padding `p-4`
- Adicionar prop `accentColor` (string hex do banco) ao `MiniKPI` para:
  - Borda esquerda colorida (`border-l-2` com `borderColor: accentColor`)
  - Micro orbe decorativo (`absolute`, `blur-2xl`, `opacity-10`, cor do banco)
- Ícone envolvido em cápsula: `<div>` com `rounded-full p-1.5` e `background: ${color}20` (translúcido)
- Valor com `text-lg font-bold` para maior destaque
- Passar `c1` (cor primária do banco) como `accentColor` para cada `MiniKPI`

### Resultado

4 cards glass individuais, alinhados em grid, cada um com ícone encapsulado, borda accent do banco, e micro glow — visual premium consistente com o design system Liquid Glass do app.

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` |

