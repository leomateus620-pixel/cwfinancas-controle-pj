

## Plano: Refinar tipografia "Cartão" + ajustar intensidade da textura Unicred

### Problemas

1. **"Cartão" está em branco plano** — não acompanha o design premium do nome do banco
2. **Textura/glow da Unicred muito forte** — as cores claras (`#B8DDFF`) diluem demais; precisa de cores mais saturadas no texto e glow mais suave
3. **Runtime error** — `const [c1] = brand.glowColors` crasha se `glowColors` for `undefined` (dados antigos em cache); precisa de fallback seguro

### Correções

**Arquivo: `src/components/credit-card/CreditCardConnectedHeader.tsx`**

**A. Estilizar "Cartão" com shimmer suave**
- Aplicar ao "Cartão" um gradiente sutil de branco → cor1 do banco → branco, com a mesma animação shimmer mas opacidade/glow reduzidos
- Isso cria unidade visual entre "Cartão" e o nome do banco sem competir com ele

**B. Reduzir intensidade do glow/reflexo**
- Drop-shadow: reduzir opacidades de `99/66/33` → `66/44/22`
- Reflexo abaixo: reduzir opacity de `0.35` → `0.2`
- Isso resolve o excesso de textura na Unicred e em todos os bancos

**C. Adicionar fallback seguro para `glowColors`**
- `const [c1, c2, c3] = brand.glowColors ?? ["#4A90D9", "#6BB3FF", "#A8D8FF"]` em ambos os pontos de destructuring (linha 28 e 67)

**Arquivo: `src/lib/cardCatalog.ts`**

**D. Ajustar Unicred `glowColors` para cores mais saturadas**
- Trocar `["#4DA6FF", "#82C4FF", "#B8DDFF"]` → `["#2B8FFF", "#4DA6FF", "#82C4FF"]`
- Cores mais profundas = texto mais legível, glow menos "lavado"

### Resultado esperado
- "Cartão Unicred" com ambas as palavras em design premium harmonizado
- Glow mais contido e elegante
- Sem crash por dados antigos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` |
| Editar | `src/lib/cardCatalog.ts` |

