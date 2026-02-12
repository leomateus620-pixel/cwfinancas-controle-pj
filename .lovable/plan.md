

# Reimplementacao do Importador e Pagina DRE

## Problema com a implementacao atual

A edge function `dre-sync` atual usa um sistema rigido de **keyword matching** com `LineKey` enums fixos (REVENUE_GROSS, TAXES, COGS, etc.). Isso significa que:
- Linhas da planilha que nao correspondem a nenhuma keyword sao **ignoradas**
- A hierarquia real da planilha (secoes/grupos) e **perdida**
- Nao suporta a coluna **TOTAL**
- Linhas com label vazio nao sao tratadas como "subtotal duplicado"

O usuario quer um importador que leia **100% das linhas validas** preservando a estrutura original.

## Nova Arquitetura

```text
+------------------+       +-------------------+       +------------------+
| Google Sheets    |       | Edge Function     |       | Supabase DB      |
| Aba "DRE"        | ----> | dre-sync (v2)     | ----> | dre_periods      |
| (auto-detect)   |       | (generic parser)  |       | dre_lines        |
+------------------+       +-------------------+       +------------------+
                                                              |
                                                              v
                                                       +------------------+
                                                       | Frontend         |
                                                       | DREPage.tsx (v2) |
                                                       | useDRE.ts (v2)   |
                                                       +------------------+
```

## Bloco 1 -- Novo Schema (migracao SQL)

Criar duas novas tabelas e manter as antigas (para nao quebrar nada durante transicao):

**Tabela `dre_periods`:**
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL
- `sheet_id` uuid (FK -> google_sheet_connections.id)
- `period_key` text NOT NULL (ex: '2025-04', '2025-05', 'TOTAL')
- `period_label` text (label original do header, ex: 'abr./25')
- `col_index` integer (indice da coluna na planilha)
- `validation_status` text DEFAULT 'ok' (valores: 'ok', 'warning', 'missing')
- `validation_notes` jsonb DEFAULT '[]'
- `last_import_at` timestamptz DEFAULT now()
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()
- UNIQUE(user_id, sheet_id, period_key)

**Tabela `dre_lines`:**
- `id` uuid PK default gen_random_uuid()
- `period_id` uuid NOT NULL (FK -> dre_periods.id ON DELETE CASCADE)
- `user_id` uuid NOT NULL
- `group_label` text (ex: 'FATURAMENTO', 'DEDUCOES', 'DESPESAS TOTAIS')
- `line_label` text NOT NULL (ex: 'Receita', 'Simples Nacional', 'Aluguel')
- `value` numeric NOT NULL DEFAULT 0
- `source_cell` text (ex: 'DRE!C12')
- `source_tab` text DEFAULT 'DRE'
- `order_index` integer NOT NULL (manter ordem do Excel)
- `is_group` boolean DEFAULT false (true = linha de secao/header)
- `is_subtotal` boolean DEFAULT false (true = linha reconhecida como subtotal)
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**RLS:** Ambas com politicas `user_id = auth.uid()` para SELECT, INSERT, UPDATE, DELETE.

**Indice:** `CREATE INDEX idx_dre_lines_period ON dre_lines(period_id)`.

## Bloco 2 -- Edge Function `dre-sync` (reescrita completa)

Reescrever `supabase/functions/dre-sync/index.ts` com logica generica:

**Fluxo detalhado:**

1. Receber `connection_id`
2. Buscar conexao + refresh token (reutilizar logica existente)
3. Listar abas da planilha e encontrar aba "DRE" (busca exata primeiro, depois fuzzy)
4. Ler aba inteira (A1:Z200)

5. **Detectar header de meses:**
   - Percorrer linhas de cima para baixo
   - Encontrar a primeira linha onde existem 3+ colunas consecutivas (a partir de B) com valores que parecem datas ou meses (patterns: `abr./25`, `mai./25`, datas seriais do Excel, `Jan`, `Fev`, etc.)
   - Nessa mesma linha, identificar coluna cujo texto normalizado seja "total"
   - Definir: `headerRowIndex`, `monthCols[]` (indices + labels), `totalColIndex`

6. **Parsear meses do header:**
   - Suportar formatos: `abr./25`, `abr/25`, `abr./2025`, `04/2025`, datas ISO, texto livre
   - Converter para `period_key` no formato `YYYY-MM`
   - Coluna TOTAL vira `period_key = 'TOTAL'`

7. **Percorrer linhas abaixo do header:**
   - Para cada linha `i` (a partir de `headerRowIndex + 1`):
     - `label = rows[i][0]` (coluna A)
     - Se `label` for vazio/null/whitespace => **IGNORAR** (subtotal duplicado)
     - Se `label` for todo maiusculo (ou contem certas palavras-chave de secao) => marcar como `is_group = true`, atualizar `currentGroup = label`
     - Caso contrario => `is_group = false`, pertence ao `currentGroup` atual
     - Extrair valores de cada coluna-mes e da coluna TOTAL usando `parseBRL`
     - Somente salvar a linha se tiver pelo menos 1 valor numerico em alguma coluna

8. **Detectar subtotais conhecidos** (para validacao, nao para filtrar):
   - Keywords de subtotal: `["receita liquida", "resultado", "despesas totais", "lucro bruto", "ebitda", "resultado mes", "resultado do mes", "total despesas"]`
   - Se a label normalizada bater com alguma keyword, marcar `is_subtotal = true`

9. **Validacao de consistencia:**
   - Para cada periodo, tentar verificar:
     - Se existe grupo FATURAMENTO + grupo DEDUCOES + subtotal RECEITA LIQUIDA: verificar se `RECEITA LIQUIDA ~= soma(itens FATURAMENTO) + soma(itens DEDUCOES)`
     - Se existe subtotal DESPESAS TOTAIS: verificar se `DESPESAS TOTAIS ~= soma(itens do grupo DESPESAS)`
   - Se divergencia > R$ 0,01: marcar `validation_status = 'warning'` no `dre_periods` com nota explicativa

10. **Salvar no banco:**
    - DELETE antigos `dre_lines` e `dre_periods` para esse user_id + sheet_id (limpar e reimportar)
    - INSERT `dre_periods` (um por coluna-mes + TOTAL)
    - INSERT `dre_lines` (uma por linha valida por periodo)
    - Retornar contagem de periodos e linhas importadas

## Bloco 3 -- Hook `useDRE.ts` (reescrita)

Novo hook com interface adaptada ao novo schema:

- **Query `dre_periods`:** buscar periodos disponiveis para o sheet_id selecionado
- **Query `dre_lines`:** buscar linhas do periodo selecionado, ordenadas por `order_index`
- **Mutation `syncDRE`:** chamar edge function `dre-sync`
- **KPIs calculados no frontend** a partir das linhas importadas:
  - Faturamento: buscar grupo "FATURAMENTO" -- usar subtotal se `is_group=true` e tem valor, senao somar itens do grupo
  - Receita Liquida: buscar linha com `is_subtotal=true` e label ~= "receita liquida", senao calcular Faturamento + Deducoes
  - Despesas Totais: buscar subtotal "DESPESAS TOTAIS", senao somar itens
  - Resultado do Mes: buscar subtotal "RESULTADO", senao calcular
  - Margem Liquida: Resultado / Receita Liquida (se != 0, senao "--")

## Bloco 4 -- Pagina `DREPage.tsx` (reescrita)

**Desktop-only guard:**
```tsx
const isDesktop = useMediaQuery("(min-width: 1024px)");
if (!isDesktop) {
  return <PlaceholderMobile message="DRE disponivel apenas no desktop." />;
}
```

**Layout desktop:**

1. **Header:** titulo "DRE" + seletor de periodo (dropdown com meses + TOTAL) + seletor de planilha (se multiplas) + botao "Atualizar DRE" + ultima atualizacao

2. **KPIs (5 cards):**
   - Faturamento (R$)
   - Receita Liquida (R$)
   - Despesas Totais (R$)
   - Resultado do Mes (R$)
   - Margem Liquida (%)

3. **Tabela DRE (layout contabil):**
   - Linhas com `is_group=true` renderizadas como header de secao (negrito, fundo diferenciado)
   - Linhas normais renderizadas abaixo do grupo, com indentacao
   - Linhas com `is_subtotal=true` em negrito com borda superior
   - Coluna: Linha DRE | Valor (R$)
   - Ordem preservada pelo `order_index`

4. **Estado vazio:** instrucao clara para criar aba DRE

5. **Skeleton loading** durante carregamento

## Bloco 5 -- Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabelas dre_periods e dre_lines com RLS |
| `supabase/functions/dre-sync/index.ts` | Reescrever (importador generico) |
| `src/hooks/useDRE.ts` | Reescrever (novo schema) |
| `src/pages/DREPage.tsx` | Reescrever (desktop-only, novo layout) |

Nao sera necessario alterar `App.tsx` nem `AppSidebar.tsx` pois ja estao com DRE configurado.

## Detalhes Tecnicos

- O `parseBRL` existente na edge function sera mantido (ja robusto para formatos BR)
- A deteccao de header suporta formatos como `abr./25` usando regex: `/^([a-z]{3,})\.?[\s\/\-]*(\d{2,4})$/`
- Linhas com label vazio sao ignoradas ANTES de qualquer processamento
- A coluna TOTAL e tratada como um periodo especial (period_key = 'TOTAL')
- O DELETE + INSERT (em vez de UPSERT) simplifica o fluxo e evita orfaos quando linhas sao removidas da planilha
- A validacao de consistencia usa tolerancia de R$ 0,01 e gera warnings internos sem bloquear a importacao

