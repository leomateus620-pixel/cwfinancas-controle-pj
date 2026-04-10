

## Plano: Seletor de Ciclos com Cores do Cartão + Liquid Glass Premium

### O que será feito

Redesenhar o `CreditCardCycleSelector` para que cada chip reflita a identidade visual do banco emissor (verde Sicredi, amarelo/azul BB, azul Banrisul), com profundidade liquid glass e micro-animações.

### Design

Cada chip de mês/cartão terá:
- **Estado ativo**: fundo com gradiente translúcido derivado do `accentColor` do banco (ex: `rgba(0,107,63,0.25)` para Sicredi), borda luminosa na cor do banco (`accentColor` com 40% opacidade), box-shadow com glow colorido, texto branco
- **Estado inativo**: fundo `white/[0.04]` com bolinha colorida do banco, texto muted, hover com leve tint da cor do banco
- **Agrupamento multi-cartão** (mesmo mês): container com borda glass, cada sub-chip usa a cor do seu respectivo banco quando ativo
- **Botão "Todos"**: mantém o estilo neutro glass (sem cor de banco)
- **Micro-animações**: `transition-all duration-300`, scale sutil no ativo (`scale-[1.02]`), glow pulsante via box-shadow

### Detalhes técnicos

Para cada ciclo, o `brand.accentColor` já está disponível via `detectCardBrand()`. O estilo ativo será aplicado via `style` inline:
```tsx
// Ativo
style={{
  background: `linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}18 100%)`,
  borderColor: `${accentColor}66`,
  boxShadow: `0 4px 20px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
}}

// Inativo hover — via onMouseEnter/Leave com estado
style={{
  background: hovered ? `${accentColor}0D` : 'rgba(255,255,255,0.04)',
}}
```

O dot indicador no ativo terá um anel de glow (`box-shadow: 0 0 6px ${accentColor}`).

### Arquivo

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/components/credit-card/CreditCardCycleSelector.tsx` |

### Escopo restrito
- Apenas o componente `CreditCardCycleSelector`
- Zero alteração em outros arquivos

