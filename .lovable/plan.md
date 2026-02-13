

# Limpar Dados e Re-sincronizar

## O que sera feito

1. **Chamar a funcao `reset-sheet-data`** para apagar todos os dados importados (transacoes, agregacoes, DRE, caches, auditorias)
2. **Disparar uma nova sincronizacao** da planilha conectada

## Passos tecnicos

### Passo 1 -- Reset total dos dados
- Invocar a edge function `reset-sheet-data` com `scope: "ALL"` e sem `connection_id` (reset total)
- Isso apaga: transactions, financial_daily_aggregates, dre_lines, dre_periods, dre_values, dre_mappings, ai_sheet_profiles, ai_insights, sheet_sync_jobs, google_sheet_sync_logs, transaction_flags

### Passo 2 -- Verificar que o banco esta limpo
- Consultar `SELECT count(*) FROM transactions` para confirmar 0 registros

### Passo 3 -- Disparar nova sincronizacao
- Invocar `sheets-sync-all-tabs` com a conexao ativa do usuario para reimportar todas as abas mensais
- A nova importacao usara a logica corrigida (paginacao, batch upsert, auditoria)

### Passo 4 -- Validar resultado
- Verificar contagem de transacoes importadas
- Verificar tabela `sync_tab_audit` para confirmar detectadas == importadas

## Arquivos envolvidos (sem alteracoes de codigo)
Nenhuma alteracao de codigo e necessaria. Apenas operacoes de dados via edge functions e queries de verificacao.

