

## Plano: Reorganizar layout dos KPIs e simplificar Caixa Atual

### Problema

1. **Sobra no canto direito**: O grid é `xl:grid-cols-4`, mas CaixaAtualCard ocupa `md:col-span-2`. São 5 cards (2+1+1+1+1=6 slots), resultando em 2 slots vazios na segunda linha.
2. **Caixa Atual com excesso de meses**: Quando não há saldos bancários (caso desta planilha), o card ainda mostra 15 botões de meses — informação inútil nesse contexto.

### Solução

**CaixaAtualCard — dois modos:**
- **Sem saldos bancários** (`isEmpty`): Card compacto, 1 coluna, mesmo formato dos outros KPIs. Mostra apenas o saldo calculado por transações, sem seletor de meses, sem drawer complexo. Adiciona link "Ver detalhes" para `/cash-flow`.
- **Com saldos bancários** (`hasBanks`): Mantém o layout expandido atual com seletor de meses e cards por banco (ocupa 2 colunas).

**Grid da HomePage:**
- Quando Caixa é compacto (sem bancos): grid de 5 cards iguais → usar `xl:grid-cols-5` ou layout `grid-cols-2 xl:grid-cols-3` para encaixar sem sobras.
- Layout proposto: primeira linha com 3 cards (Caixa, Entradas, Saídas), segunda linha com 2 cards (Resultado, Fôlego) — usando `lg:grid-cols-3` na primeira e centralizando a segunda.

Alternativa mais limpa: manter `xl:grid-cols-4` e quando Caixa é 1 col, são 5 cards em 4 colunas → row 1: 4 cards, row 2: 1 card. Melhor: usar grid responsivo `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` para que os 5 cards caibam em uma única linha em telas grandes.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/home/CaixaAtualCard.tsx` | Condicionar layout: sem bancos → card compacto (1 col, sem meses); com bancos → layout atual expandido |
| `src/pages/HomePage.tsx` | Ajustar grid classes para acomodar os dois cenários sem sobras |

