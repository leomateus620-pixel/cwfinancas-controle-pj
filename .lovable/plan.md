

# Roteamento de Abas + Importacao Multi-Tab de Transacoes

## Problema Atual

O sync atual (`google-sheets-sync`) le apenas UMA aba por vez (a que esta configurada na conexao). Quando o usuario seleciona "Todas as Abas", o sistema tenta ler tudo de uma vez sem distinguir abas mensais da aba DRE, causando mistura de dados ou perda de linhas.

## Nova Arquitetura

```text
Planilha Google Sheets
  |
  |-- Aba "DRE"          --> dre-sync (existente, ja funciona)
  |-- Aba "Janeiro"       |
  |-- Aba "Fevereiro"     |--> sheets-sync-all-tabs (NOVA edge function)
  |-- Aba "Marco"         |    - Roteador classifica cada aba
  |-- ...                 |    - So importa MONTHLY_TRANSACTIONS no range escolhido
  |-- Aba "Dezembro"      |
  |-- Aba "Santo Angelo"  --> IGNORE_FOR_MAIN_SYNC
```

## Bloco 1 -- Tab Router (utilidade compartilhada dentro da edge function)

Logica de classificacao de abas implementada na nova edge function:

**DRE_ONLY:** nome exato "DRE" (case-insensitive) ou contem "Demonstracao" / "Resultado"

**MONTHLY_TRANSACTIONS:** deteccao de meses PT-BR:
- Nomes completos: "Janeiro"..."Dezembro" (case-insensitive)
- Abreviacoes: "Jan"..."Dez"
- Com ano: "Jan/2025", "Janeiro 2025", "dez/25", "Jun/26"
- Cada match retorna um `period_key` (YYYY-MM) + indice de ordenacao (1-12)

**IGNORE:** qualquer outra aba

## Bloco 2 -- Nova Edge Function `sheets-sync-all-tabs`

Criar `supabase/functions/sheets-sync-all-tabs/index.ts`

**Entrada:**
```json
{
  "connection_id": "uuid",
  "month_range": { "from": "2025-06", "to": "2025-12" }
}
```

**Fluxo:**
1. Buscar conexao + refresh token (reutiliza logica existente do `google-sheets-sync`)
2. Buscar metadata da planilha (lista de abas)
3. Classificar cada aba pelo roteador
4. Filtrar apenas `MONTHLY_TRANSACTIONS` dentro do `month_range`
5. Ordenar cronologicamente
6. Para cada aba mensal:
   - Ler dados (A1:Z1000)
   - Detectar header (reutiliza `autoDetectMapping` existente)
   - Importar linhas usando a mesma logica do `google-sheets-sync` (parseBRL, extractAmount, parseDate, idempotencia por external_row_key)
   - O `source_tab` salvo sera o nome real da aba (ex: "Junho")
7. Retornar resultado agregado: abas importadas, linhas por aba, erros

**Importante:** a aba DRE e COMPLETAMENTE ignorada por esta funcao.

## Bloco 3 -- UI: Modal de Selecao Atualizado

Modificar `SpreadsheetSelectorModal.tsx`:

Quando o usuario seleciona "Todas as Abas", adicionar um passo intermediario (novo step `"month-range"`):

1. **Step "sheets"**: usuario clica em "Todas as Abas"
2. **Step "month-range"** (NOVO):
   - Titulo: "Selecionar periodo de importacao"
   - Dois dropdowns: "Mes inicial" e "Mes final"
   - Lista dos meses disponiveis (detectados das abas da planilha)
   - Informativo: "A aba DRE sera importada separadamente no menu DRE"
   - Padrao inteligente: ultimos 6 meses disponiveis
3. **Step "confirm"**: mostra resumo incluindo range selecionado

Quando o usuario seleciona uma aba individual, o fluxo permanece igual (sem step de range).

## Bloco 4 -- Hook `useGoogleSheets` Atualizado

Adicionar ao hook:

- Nova mutation `syncAllTabs` que chama `sheets-sync-all-tabs`
- O `createConnection` passa a salvar `data_type: "all_tabs"` e um campo `month_range` no `column_mapping` (ou num campo dedicado) quando o modo e "Todas as Abas"

## Bloco 5 -- GoogleSheetsPage: Botao de Sync Inteligente

Quando a conexao tem `sheet_name === null` (todas as abas):
- O botao "Sincronizar" chama `syncAllTabs` em vez de `syncData`
- Mostra contadores pos-sync: "X abas mensais, Y linhas importadas, DRE separada"

## Bloco 6 -- Garantia de Separacao (DRE vs Transacoes)

**Transacoes (tabela `transactions`):**
- Alimentam: Home, Dashboard, Receitas, Despesas, Fluxo de Caixa, Previsoes
- Fonte: abas mensais apenas
- `source_tab` = nome da aba mensal (ex: "Junho")

**DRE (tabelas `dre_periods` + `dre_lines`):**
- Alimenta: SOMENTE o menu DRE
- Fonte: aba DRE apenas
- Importacao separada via botao "Atualizar DRE" na pagina DRE

Nenhum codigo existente nos hooks de transacoes (useTransactions, useHomeDashboard, etc.) precisa mudar, pois eles ja consultam a tabela `transactions` que so recebe dados de abas mensais.

## Bloco 7 -- config.toml

Adicionar:
```toml
[functions.sheets-sync-all-tabs]
verify_jwt = false
```

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Criar (nova edge function) |
| `supabase/config.toml` | Adicionar nova funcao |
| `src/components/modals/SpreadsheetSelectorModal.tsx` | Adicionar step "month-range" |
| `src/hooks/useGoogleSheets.ts` | Adicionar mutation `syncAllTabs` |
| `src/pages/GoogleSheetsPage.tsx` | Sync inteligente (all tabs vs single tab) |

## Detalhes Tecnicos

- A nova edge function reutiliza as mesmas funcoes utilitarias do `google-sheets-sync`: `parseBRL`, `parseDate`, `autoDetectMapping`, `extractAmount`, `isSkippableRow`, `generateRowHash`, `refreshAccessToken`
- Idempotencia: o `external_row_key` inclui o nome da aba, entao linhas de abas diferentes nunca colidem
- A deteccao de meses usa um mapa PT-BR completo (Jan-Dez, Janeiro-Dezembro) com suporte a variantes com ano
- O month_range usa comparacao de strings "YYYY-MM" para filtrar abas no intervalo
- A aba DRE nunca e processada pela funcao de transacoes -- hard-coded como `IGNORE`

