

## Plano: Reorganizar Layout dos Cards da Home

### Problema

O card "Caixa Atual" ocupa 2 colunas (`md:col-span-2`) com detalhamento interno de bancos, enquanto os outros 3 KPIs ocupam 1 coluna cada. Isso cria um desequilíbrio visual — o Caixa é desproporcional e a linha KPI fica pesada demais, poluindo a tela.

### Solução

Reorganizar em **duas linhas** com proporções equilibradas:

```text
ANTES (1 linha, 5 colunas desbalanceadas):
[  Caixa Atual (2col)  ] [Entradas] [Saídas] [Resultado] [Fôlego]

DEPOIS (2 linhas, limpas e proporcionais):
Linha 1: [Entradas (1)] [Saídas (1)] [Resultado (1)] [Fôlego (1)]   ← 4 KPIs iguais
Linha 2: [Caixa Atual (2col)] [Evolução do Caixa (2col)]             ← 2 cards 50/50
Linha 3: [Health Score (1)] [Top Despesas (1)] [Alertas (1)] [Qualidade Lucro (1)]
```

**Mudanças específicas:**

1. **HomePage.tsx** — Reestruturar o grid:
   - Linha 1: 4 KPIs em `grid-cols-4` (Entradas, Saídas, Resultado, Fôlego) — cards iguais, compactos
   - Linha 2: Caixa Atual + Evolução do Caixa em `grid-cols-2` (50/50)
   - Linha 3: Health Score + Top Despesas + Alertas + Qualidade Lucro em `grid-cols-4`

2. **CaixaAtualCard.tsx** — Remover `md:col-span-2` do wrapper expandido, ajustar padding para `p-5 md:p-6` (mais compacto), reduzir espaçamentos internos

3. **HomeKPICard.tsx** — Reduzir tamanho do valor de `text-2xl md:text-3xl` para `text-xl md:text-2xl` para ficar mais compacto

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/HomePage.tsx` | Reestruturar grid em 3 linhas equilibradas |
| `src/components/home/CaixaAtualCard.tsx` | Compactar card, remover col-span-2 |
| `src/components/home/HomeKPICard.tsx` | Reduzir tamanho do valor para layout mais limpo |

