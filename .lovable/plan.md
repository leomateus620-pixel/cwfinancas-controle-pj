

## Redesign Visual: Cards de Contas a Pagar / Receber

### Objetivo
Reformular os cards PayableCard e ReceivableCard com visual Liquid Glass Premium: fundo com gradiente texturizado, orbes decorativos, e toggle para esconder/mostrar a tabela de detalhes (descrição), mantendo KPIs sempre visíveis.

### Mudancas

#### 1. PayableCard.tsx -- Redesign completo
- Substituir `GlassCard` por container customizado com classe `liquid-glass-card` (já existe no CSS)
- Adicionar orbes decorativos de gradiente (amber para pagar) com blur-3xl no background
- Header com icone em capsula translucida com glow sutil
- KPIs com fundo glass interno (`liquid-glass-compact` ou similar)
- Botao toggle "Mostrar detalhes" / "Esconder detalhes" com icone Eye/EyeOff
- Estado `showDetails` controla visibilidade da tabela
- Animacao de transicao suave na tabela (max-height + opacity)

#### 2. ReceivableCard.tsx -- Mesmo redesign
- Mesma estrutura, cores emerald em vez de amber
- Orbes decorativos verdes
- Mesmo toggle de detalhes

#### 3. AccountsPage.tsx -- Layout full-width
- Mudar de `grid xl:grid-cols-2` para stack vertical (`space-y-6`) para dar mais espaco aos cards redesenhados com tabelas largas

### Detalhes visuais
- Fundo do card: `liquid-glass-card` com `::before` e `::after` pseudo-elements (gradiente + noise texture)
- Borda lateral colorida mantida (amber-400 / emerald-400)
- KPIs internos: glass compacto com bordas translucidas
- Toggle: botao ghost com icone Eye/EyeOff, alinhado ao header
- Tabela com header glass e rows com hover sutil

### Arquivos modificados
- `src/components/accounts/PayableCard.tsx`
- `src/components/accounts/ReceivableCard.tsx`
- `src/pages/AccountsPage.tsx` (layout)

