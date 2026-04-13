

## Plano: Efeito "WOW" no nome do cartão — Typography Premium

### Objetivo

Transformar o título "Cartão **Unicred**" (e todos os outros bancos) em um elemento visual de alto impacto, usando técnicas avançadas de CSS para criar um efeito de texto luminoso, animado e com profundidade.

### Design

O nome do banco terá:
1. **Gradiente multi-stop com a paleta da marca** — em vez de um gradiente monotone, usar 3 cores: a accent, uma versão mais clara e uma versão saturada diferente, criando profundidade cromática
2. **Animação sutil de shimmer** — um brilho que percorre o texto continuamente (como um reflexo de luz passando por metal polido), usando `background-size: 200%` + `@keyframes` de `background-position`
3. **Múltiplas camadas de glow** — 3 níveis de `drop-shadow` com raios crescentes para simular emissão de luz real
4. **Pseudo-elemento de reflexo** — um `::after` com blur que simula luz refletida abaixo do texto
5. **Escala ligeiramente maior** — `text-3xl` para o nome do banco vs `text-2xl` para "Cartão", criando hierarquia

### Paleta por banco (gradiente do texto)

| Banco | Cor 1 | Cor 2 | Cor 3 |
|-------|-------|-------|-------|
| Unicred | `#4DA6FF` | `#82C4FF` | `#B8DDFF` |
| Nubank | `#B24BF3` | `#D17BFF` | `#E8A8FF` |
| Sicredi | `#00D47E` | `#4AE8A5` | `#7AFFCA` |
| BB | `#FFCD00` | `#FFE04D` | `#FFF099` |
| Banrisul | `#4DA6FF` | `#78C0FF` | `#A8D8FF` |

Cada marca terá um campo `glowColors: [string, string, string]` no `CardBrand` para alimentar o gradiente animado.

### Implementação

**Arquivo 1: `src/lib/cardCatalog.ts`**
- Adicionar campo `glowColors: [string, string, string]` à interface `CardBrand`
- Preencher para cada banco com as 3 cores do gradiente

**Arquivo 2: `src/components/credit-card/CreditCardConnectedHeader.tsx`**
- Substituir o `<span>` do nome do banco por um componente `<BrandTitle>` com:
  - `background: linear-gradient(90deg, cor1, cor2, cor3, cor1)` + `background-size: 200% auto`
  - `animation: shimmer 3s linear infinite`
  - `WebkitBackgroundClip: text` + `WebkitTextFillColor: transparent`
  - 3 camadas de `drop-shadow` com a cor primária em opacidades decrescentes
  - Um `<span>` absoluto posicionado abaixo com `blur(12px)` e `opacity(0.4)` como reflexo

**Arquivo 3: `src/index.css`**
- Adicionar `@keyframes shimmer` para animação do gradiente

### Resultado esperado

O nome do banco terá um efeito de texto luminoso e animado que parece "vivo" — como letras de neon ou metal cromado iluminado — mantendo a identidade de cor de cada banco. O efeito é sutil e elegante, não agressivo.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/lib/cardCatalog.ts` |
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` |
| Editar | `src/index.css` |

