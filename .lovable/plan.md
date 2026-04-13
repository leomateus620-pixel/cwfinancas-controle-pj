

## Plano: "Cartão" com design premium adaptado à cor de cada banco

### Problema

O "Cartão" está com classes genéricas (`bg-primary-foreground`, `text-[#3f40a2]`, `border-2`, `font-serif`) que não combinam com o design Liquid Glass do projeto e não se adaptam à identidade visual de cada banco.

### Solução

Transformar "Cartão" num elemento que usa a **cor mais forte/escura do banco** (via `accentColor` do catálogo), com o mesmo estilo shimmer do `BrandTitle` mas numa tonalidade mais intensa — criando contraste hierárquico onde "Cartão" é mais forte e o nome do banco é mais luminoso.

### Mudanças em `CreditCardConnectedHeader.tsx`

**Substituir o `<span>` do "Cartão" (linha 91-93)** por um componente inline com:
- Gradiente shimmer usando `accentColor` como cor dominante (mais escura/saturada que as `glowColors`)
- Mesmo `animate-cc-shimmer`, `WebkitBackgroundClip: text`, `WebkitTextFillColor: transparent`
- Drop-shadow sutil com `accentColor` para glow coerente
- Classes: `text-3xl font-extrabold tracking-tight` — sem `font-serif`, sem `border`, sem `bg-primary-foreground`
- Resultado: visual idêntico ao `BrandTitle` mas com cor mais forte/densa

**Lógica de cor**: usar `brand.accentColor` (que é a cor mais forte de cada marca — amarelo BB, roxo Nubank, verde Sicredi, azul Unicred/Banrisul) como base do gradiente do "Cartão", misturando com branco nas pontas para o shimmer.

```typescript
// Exemplo do gradiente para "Cartão":
background: `linear-gradient(90deg, ${accent}cc, ${accent}, #ffffffcc, ${accent}, ${accent}cc)`
```

### Resultado esperado

"Cartão" aparece em cor forte/saturada do banco, "Unicred" aparece em tons mais claros/luminosos — hierarquia visual clara, design unificado, adaptado por banco.

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` |

