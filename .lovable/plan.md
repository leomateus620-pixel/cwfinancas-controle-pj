

# DRE - Demonstracao do Resultado do Exercicio

## Visao Geral

Substituir o menu "Balanco Patrimonial" por uma pagina de DRE completa, alimentada exclusivamente pela aba "DRE" da planilha Google Sheets do cliente. Inclui importador especializado, validacao de consistencia matematica, rastreabilidade de origem (aba/celula), e UI com KPIs + tabela estruturada.

## Arquitetura

```text
+------------------+       +-------------------+       +------------------+
| Google Sheets    |       | Edge Function     |       | Supabase DB      |
| Aba "DRE"        | ----> | dre-sync          | ----> | dre_values       |
| (auto-detect)   |       | (parse + validate)|       | dre_mappings     |
+------------------+       +-------------------+       +------------------+
                                                              |
                                                              v
                                                       +------------------+
                                                       | Frontend         |
                                                       | DREPage.tsx      |
                                                       | useDRE.ts        |
                                                       +------------------+
```

## Entregaveis (6 blocos)

### Bloco 1 -- Banco de Dados (migracoes)

**Tabela `dre_values`:**
- `id` uuid PK
- `user_id` uuid NOT NULL
- `sheet_id` uuid (referencia a `google_sheet_connections.id`)
- `period_key` text (ex: "2026-01", "2025")
- `line_key` text NOT NULL (enum logico: REVENUE_GROSS, TAXES, REVENUE_NET, COGS, GROSS_PROFIT, OPEX_TOTAL, OPEX_ADMIN, OPEX_SALES, OPEX_PAYROLL, OPEX_FINANCE, OPEX_OTHER, EBITDA, OPERATING_INCOME, FIN_RESULT, PRE_TAX_INCOME, IR_CSLL, NET_INCOME)
- `value` numeric NOT NULL
- `source_tab` text
- `source_cell` text (ex: "DRE!C12")
- `source_label` text (texto original da linha encontrada)
- `is_calculated` boolean DEFAULT false (se foi recalculado internamente)
- `original_value` numeric (valor original da planilha, para comparacao)
- `created_at` / `updated_at`
- UNIQUE(user_id, sheet_id, period_key, line_key)

**Tabela `dre_mappings`:**
- `id` uuid PK
- `user_id` uuid NOT NULL
- `sheet_id` uuid
- `tab_name` text
- `header_signature` text
- `mapping` jsonb (line_key -> {row_index, label, keywords_matched})
- `format_detected` text ("columns_by_month" ou "block_summary")
- `confidence` numeric DEFAULT 0.5
- `created_at` / `updated_at`
- UNIQUE(user_id, sheet_id, header_signature)

**RLS:** Ambas com politicas user_id = auth.uid() para SELECT, INSERT, UPDATE, DELETE.

### Bloco 2 -- Edge Function `dre-sync`

Nova funcao em `supabase/functions/dre-sync/index.ts`.

**Fluxo:**
1. Recebe `connection_id` (da planilha conectada)
2. Busca a conexao e tokens OAuth (refresh se necessario, reutiliza logica existente)
3. Busca metadata da spreadsheet (lista de abas)
4. Auto-detect da aba DRE: procura abas com nomes ["DRE","dre","Demonstracao","Resultado","DRE 2025","DRE 2026"] (case-insensitive, sem acentos)
5. Se nao encontrar: retorna `{ found: false, message: "Aba DRE nao encontrada" }`
6. Le toda a aba DRE (A1:Z200)
7. Detecta formato:
   - **Formato 1 (colunas por mes):** primeira linha/coluna tem labels, colunas subsequentes tem meses
   - **Formato 2 (bloco resumo):** labels e valores em pares (coluna A = label, coluna B = valor)
8. Mapeia cada linha por palavras-chave (case/acento insensitive):
   - REVENUE_GROSS: ["receita bruta","faturamento","receitas","receita operacional bruta"]
   - TAXES: ["impostos","deducoes","iss","icms","pis","cofins","taxas sobre receita","deducao"]
   - COGS: ["custo","cmv","csp","custo dos servicos","custo mercadoria","cpv"]
   - OPEX_ADMIN: ["administrativa","administracao","adm","despesas administrativas"]
   - OPEX_SALES: ["comercial","marketing","vendas","trafego","despesas comerciais"]
   - OPEX_PAYROLL: ["salario","pessoal","folha","pro-labore","pro labore","prolabore"]
   - OPEX_FINANCE: ["financeiro","juros","tarifas","taxa bancaria","despesas financeiras"]
   - OPEX_OTHER: ["outras","diversas","outras despesas"]
   - (tambem aceita subtotais prontos: REVENUE_NET, GROSS_PROFIT, EBITDA, etc.)
9. Para cada periodo (coluna-mes ou bloco):
   - Extrai valores base usando `parseBRL` (reutiliza logica existente)
   - Recalcula subtotais internamente:
     - REVENUE_NET = REVENUE_GROSS - TAXES
     - GROSS_PROFIT = REVENUE_NET - COGS
     - OPEX_TOTAL = soma(OPEX_ADMIN + OPEX_SALES + OPEX_PAYROLL + OPEX_FINANCE + OPEX_OTHER)
     - EBITDA = GROSS_PROFIT - OPEX_TOTAL
     - OPERATING_INCOME = EBITDA (ajustado se houver depreciacao)
     - NET_INCOME = OPERATING_INCOME + FIN_RESULT - IR_CSLL
   - Compara com valores informados na planilha; se divergir, armazena `is_calculated=true` e `original_value`
10. UPSERT em `dre_values` (chave: user_id + sheet_id + period_key + line_key)
11. Salva/atualiza `dre_mappings` com cache do mapeamento
12. Retorna resultado detalhado

**Rastreabilidade:** cada valor salvo inclui `source_tab` (ex: "DRE"), `source_cell` (ex: "DRE!C12"), `source_label` (ex: "Receita Bruta de Servicos").

### Bloco 3 -- Hook `useDRE.ts`

Novo hook em `src/hooks/useDRE.ts`:
- Query `dre_values` filtrado por user_id, sheet_id, period_key
- Query `dre_mappings` para saber se ja tem cache
- Mutation `syncDRE` que chama a edge function `dre-sync`
- Calculos de margens no frontend (redundancia de seguranca):
  - Margem Bruta = GROSS_PROFIT / REVENUE_NET
  - Margem EBITDA = EBITDA / REVENUE_NET
  - Margem Liquida = NET_INCOME / REVENUE_NET
  - Se REVENUE_NET = 0, retorna null (exibe "--")
- Lista de periodos disponiveis (extraidos dos period_keys unicos)
- Estado de validacao (campos com `is_calculated=true` e `original_value` diferente)

### Bloco 4 -- Pagina `DREPage.tsx`

Nova pagina em `src/pages/DREPage.tsx`:

**Header:**
- Titulo "DRE" com icone BarChart3
- Seletor de periodo (dropdown com meses disponiveis + opcao YTD)
- Seletor de planilha (se houver multiplas conexoes)
- "Ultima atualizacao" + botao "Atualizar DRE"

**KPIs (7 cards no topo):**
- Receita Liquida (R$)
- Lucro Bruto (R$)
- EBITDA (R$)
- Resultado Liquido (R$)
- Margem Bruta (%)
- Margem EBITDA (%)
- Margem Liquida (%)

**Tabela DRE (layout classico contabil):**

| Linha DRE | Valor (R$) | % Receita Liq. | Status |
|---|---|---|---|
| Receita Bruta | 150.000 | -- | ok |
| (-) Deducoes/Impostos | -12.000 | -- | ok |
| **Receita Liquida** | **138.000** | 100% | ok |
| (-) Custos/CMV | -45.000 | 32,6% | ok |
| **Lucro Bruto** | **93.000** | 67,4% | ok |
| (-) Despesas Operacionais | | | |
| ... Administrativas | -15.000 | 10,9% | ok |
| ... Comerciais | -8.000 | 5,8% | ok |
| ... Pessoal | -25.000 | 18,1% | ok |
| ... Financeiras | -3.000 | 2,2% | ok |
| ... Outras | -2.000 | 1,4% | ok |
| **Total Despesas Op.** | **-53.000** | 38,4% | ok |
| **EBITDA** | **40.000** | 29,0% | ok |
| Resultado Financeiro | -1.500 | 1,1% | ok |
| **Resultado Liquido** | **38.500** | 27,9% | ok |

- Linhas de subtotal em negrito com fundo diferenciado
- Coluna "Status": icone discreto de check (validado) ou alerta (divergencia com tooltip)

**Estado vazio:** se nao houver aba DRE na planilha, mostra instrucao clara com template sugerido.

**Estado de carregamento:** skeleton loading consistente com o resto do app.

### Bloco 5 -- Navegacao e Rotas

**AppSidebar.tsx:**
- Substituir `{ title: "Balanco Patrimonial", url: "/balance", icon: Scale }` por `{ title: "DRE", url: "/dre", icon: BarChart3 }`

**App.tsx:**
- Remover import de `BalanceSheetPage`
- Adicionar import de `DREPage`
- Substituir rota `/balance` por `/dre`

**config.toml:**
- Adicionar entrada `[functions.dre-sync]` com `verify_jwt = false`

### Bloco 6 -- Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/dre-sync/index.ts` | Criar |
| `src/pages/DREPage.tsx` | Criar |
| `src/hooks/useDRE.ts` | Criar |
| `src/App.tsx` | Modificar (rota) |
| `src/components/layout/AppSidebar.tsx` | Modificar (menu) |
| `supabase/config.toml` | Modificar (nova funcao) |
| Migracao SQL | Criar tabelas dre_values e dre_mappings |

## Detalhes Tecnicos Importantes

- A edge function `dre-sync` reutiliza a mesma logica de refresh de token OAuth e `parseBRL` ja existente no `google-sheets-sync`
- O mapeamento por palavras-chave usa normalizacao NFD para ignorar acentos (ex: "Despesas Financeiras" == "despesas financeiras" == "DESPESAS FINANCEIRAS")
- A deteccao de formato (colunas por mes vs bloco) analisa a primeira linha: se as colunas apos a primeira tiverem nomes de meses (Jan, Fev, Mar...) ou datas, e Formato 1; caso contrario, Formato 2
- Cada UPSERT usa a constraint UNIQUE(user_id, sheet_id, period_key, line_key) para idempotencia
- A pagina BalanceSheetPage atual usa dados estaticos (hardcoded); nao ha perda de dados reais ao remove-la

