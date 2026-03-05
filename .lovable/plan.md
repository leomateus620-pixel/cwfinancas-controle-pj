
Diagnóstico confirmado (com dados reais):
- A conexão ativa está em `data_type=transactions` e `sheet_name=Mar2026`.
- O botão de sincronizar dessa conexão chama `google-sheets-sync` (não `sheets-sync-all-tabs`).
- A extração de `SALDO BANCÁRIO` foi implementada só em `sheets-sync-all-tabs`.
- Resultado: `bank_balances` está vazio (`SELECT` retornou 0 linhas) e o card fica em estado “Sem dados”.

Plano de correção (foco em funcionar 100% no fluxo real usado hoje):

1) Corrigir o fluxo certo: `supabase/functions/google-sheets-sync/index.ts`
- Adicionar instrumentação `[bank-balance]`:
  - `tab`, `txCols`, `foundAnchor` no dataset de transações.
  - range usado para saldo (`H3:J5` e fallback `H1:J20`), quantidade de linhas/colunas.
- Implementar segunda leitura dedicada para saldos (sem mexer no range atual de transações):
  - Tentar `'<aba>'!H3:J5`
  - Fallback `'<aba>'!H1:J20`
- Para `.xlsx`, extrair bloco H-J da aba parseada (colunas 7-9), limitado ao topo (H1:J20), mantendo o pipeline atual intacto.

2) Robustez do parser de saldo (no mesmo arquivo)
- Portar/adaptar `extractBankBalances` para matriz 3 colunas (banco/inicial/final).
- Suportar:
  - Modo âncora (“SALDO BANCÁRIO”)
  - Modo fixo (header na primeira linha do bloco)
- Parse BRL robusto (incluindo negativos), `null` + warning quando inválido.
- Soft-fail total: erro no saldo nunca interrompe sync de transações.

3) `period_key` consistente
- Adicionar helper no `google-sheets-sync` para derivar `YYYY-MM` de `sheet_name` (ex.: `Mar2026`, `Jan26`).
- Fallback para mês atual apenas se não conseguir inferir.
- Log obrigatório: `tab`, `period_key`, `rowsExtracted`.

4) Persistência e validação pós-upsert
- Upsert em `bank_balances` com conflito `user_id,connection_id,period_key,bank_name`.
- Após upsert, confirmar com `count` por `user_id+connection_id+period_key`.
- Logar warnings e contexto de erro sem abortar sync.

5) Garantir atualização imediata no front
- `src/hooks/useGoogleSheets.ts`:
  - Em `syncData.onSuccess`, invalidar também:
    - `["bank-balances"]`
    - `["home-dashboard"]`
- (Opcional de diagnóstico) `useBankBalances.ts`: logar `periodKey` e quantidade retornada em modo dev.

Teste de validação (end-to-end):
- Executar sincronização manual da conexão ativa.
- Verificar logs do `google-sheets-sync` contendo `[bank-balance]` com range e `period_key`.
- Validar banco:
  - `SELECT period_key, bank_name, opening_balance, closing_balance FROM bank_balances WHERE connection_id='<id>' ORDER BY bank_name;`
- Validar UI Home:
  - card mostra totais inicial/final,
  - lista bancos (Sicredi/Caixinha etc.),
  - “Ver detalhes” abre e exibe tabela completa.
- Regressão:
  - contagem de transações importadas permanece equivalente ao comportamento atual (sem quebra do pipeline A–F).

Critério de aceite final:
- Mesmo usando sync padrão (`google-sheets-sync`), o card deixa de ficar vazio e passa a refletir os valores de H3:J5 (fallback H1:J20), com `period_key` correto e sem impacto no fluxo existente de transações.
