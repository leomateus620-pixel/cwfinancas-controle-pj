

## Plano: Cores vibrantes no seletor de ciclos + título colorido por banco

### Problemas identificados

1. **Seletor de ciclos sem cor visível**: Os chips usam `${accentColor}33` (20% opacidade) e `${accentColor}18` (9%) — tão transparente que parece cinza no fundo escuro. Precisa de opacidade muito maior.

2. **Título "Cartão Sicredi" sem cor do banco**: O `cycleName` no `ConnectedHeader` é exibido em branco puro. Precisa separar "Cartão" (branco neutro) do nome do banco (na cor do banco com efeito liquid glass).

### O que será feito

**1. CreditCardConnectedHeader.tsx — Título com cor do banco**
- Separar o título em duas partes: "Cartão" em branco e o nome do banco (ex: "Sicredi", "Banco do Brasil") estilizado com `color: brand.accentColor`, text-shadow com glow na cor do banco
- Usar `brand.accentColor` diretamente no texto do nome

**2. CreditCardCycleSelector.tsx — Cores vivas nos chips**
- Estado ativo: aumentar opacidade do gradiente de `33/18` para `55/35` (mais saturado), borda de `66` para `90`, box-shadow mais intenso com `50` em vez de `30`
- Estado hover inativo: de `0D` para `20`
- Dot ativo: glow mais forte com spread maior
- Container de grupo multi-cartão: borda colorida do cartão ativo (não branca genérica)

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` (título bicolor) |
| Editar | `src/components/credit-card/CreditCardCycleSelector.tsx` (opacidades mais altas) |

### Escopo restrito
- Apenas 2 componentes visuais
- Zero alteração em lógica de dados ou catálogo

