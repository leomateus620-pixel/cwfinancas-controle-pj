

# Correcao de Duplicatas e Consistencia entre Telas

## Diagnostico Confirmado

O banco tem **1.486 transacoes**, mas apenas **1.024 sao unicas** (pelo `external_row_key`). Isso significa **462 duplicatas** que inflam os valores em todas as telas.

Apos deduplicacao, os totais corretos sao exatamente:
- Receitas: R$ 522.587,81
- Despesas: R$ 506.598,59

Adicionalmente, existem **26 linhas da aba JAN/25** que nao deveriam ter sido importadas (fora do intervalo Abr-Dez).

### Causa-raiz
O `upsert` do Supabase JS nao funciona corretamente com indices unicos parciais (`WHERE external_row_key IS NOT NULL`). O resultado e que as linhas sao inseridas em vez de atualizadas, gerando duplicatas.

## Solucao em 3 Passos

### Passo 1 -- Limpar duplicatas e linhas indevidas (via SQL)

1. Deletar as 26 transacoes da aba `JAN/25` (fora do escopo)
2. Deletar duplicatas mantendo apenas o registro mais recente por `external_row_key`

Resultado esperado: exatamente 1.024 transacoes no banco.

### Passo 2 -- Corrigir o indice unico para prevenir futuras duplicatas

O problema e que existem 2 indices parciais que nao funcionam com `.upsert()` do Supabase JS. A solucao:
- Remover os 2 indices parciais existentes
- Criar 1 indice unico NOT partial (sem clausula WHERE) que funcione com upsert
- O indice sera: `UNIQUE (user_id, source_sheet_id, external_row_key)` sem condicao WHERE, permitindo que o `onConflict` funcione corretamente

### Passo 3 -- Ajustar a edge function `sheets-sync-all-tabs`

Alterar a chamada de upsert para usar o novo indice sem clausula parcial. O `onConflict` passara a funcionar corretamente, impedindo duplicatas em futuras sincronizacoes.

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | Limpar duplicatas + JAN/25 + recriar indice unico |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Ajustar upsert para funcionar com novo indice |

## Resultado esperado

- Banco: exatamente 1.024 transacoes
- Receitas: R$ 522.587,81
- Despesas: R$ 506.598,59
- Resultado: R$ 15.989,22
- Todas as telas (Dashboard, Receitas, Despesas, Fluxo de Caixa) mostrando os mesmos valores
- Futuras sincronizacoes nao criarao duplicatas

