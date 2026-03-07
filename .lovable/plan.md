
Objetivo: corrigir definitivamente o módulo Contas a Pagar/Receber para a planilha **Financeiro GR - 2026.xlsx**, validando especificamente as abas de contas e garantindo dados reais por mês no menu `/accounts`.

1) Diagnóstico confirmado (causa real, etapa exata)
- Etapa 1 (roteamento no frontend): a conexão ativa no banco é apenas `Mar2026` (`data_type=transactions`), então o botão Sincronizar ainda cai no fluxo de aba única em vez do pipeline APR.
- Etapa 2 (início do pipeline APR): ao chamar `sheets-sync-all-tabs`, a execução para logo no lock (`423 sync_locked`) mesmo com `lock_until = null`; o lock atual usa filtro `.or(...)` frágil e não loga erro detalhado.
- Etapa 3 (parse da aba receber): a aba **Contas a receber 2026** tem cabeçalhos mensais como serial numérico Excel (`46023`, `46054`, ...). O parser APR atual detecta mês só por texto (Jan/Fev/...), então esse layout cai em interpretação errada e tende a importar zero.

2) Correção proposta (implementação)
A. `supabase/functions/sheets-sync-all-tabs/index.ts`
- Corrigir lock:
  - substituir `acquireLock` por estratégia robusta (sem `.or` textual): tentativa com `lock_until is null` e fallback `lock_until < now`.
  - registrar logs explícitos de lock (`acquired`, `not acquired`, `error`), com `requestId` e `connectionId`.
- Melhorar seleção APR:
  - manter pagar/receber separados.
  - quando houver múltiplas abas do mesmo tipo (ex.: “Contas a receber” e “Contas a receber 2026”), priorizar aba com ano inferido da planilha (2026), logando quais foram ignoradas para evitar duplicidade.
- Melhorar detecção de mês em APR:
  - estender `detectMonthFromText` para reconhecer datas seriais Excel e datas numéricas de cabeçalho, extraindo `year-month`.
- Melhorar parser horizontal APR para layout GR:
  - mapear colunas fixas da esquerda (`Vcto`, `Despesa/Cliente`, `Forma de pgto`) corretamente.
  - não usar “Vcto” como descrição.
  - preencher `description`, `payment_method`, e `due_date` quando possível.
- Telemetria anti-regressão:
  - logs por aba APR: layout detectado, headers reconhecidos, quantidade parseada, upsert e cleanup.
  - incluir contadores APR no resumo final da função e no payload de retorno.

B. `src/pages/GoogleSheetsPage.tsx`
- Ajustar `handleSync` para usar `syncAllTabs` também em conexões de arquivo `.xlsx` (não só all_tabs/APR explícito), garantindo que o pipeline APR rode no cenário atual.
- Log de decisão de roteamento (`single-tab` vs `all-tabs`) para diagnóstico.

C. `src/hooks/useGoogleSheets.ts`
- Ajustar mensagem de sucesso para refletir importação APR (não apenas abas mensais).
- Manter invalidação de cache de `apr-payable` e `apr-receivable` após sync (já existe, validar consistência).

3) Validação ponta a ponta (com foco nas abas pedidas)
- Pré-validação:
  - confirmar leitura das abas da planilha: `Contas a pagar 2026` e `Contas a receber 2026`.
- Execução:
  - disparar nova sincronização via pipeline corrigido.
- Validação de persistência:
  - consultar `accounts_payable_receivable` por `record_type` e `period_key` e confirmar linhas > 0.
  - confirmar separação: `payable` e `receivable` em buckets distintos.
- Validação funcional na UI:
  - abrir `/accounts`, mês **Março 2026**.
  - confirmar cards com valores reais (não zerados) para Pagar e Receber.
  - confirmar tabelas preenchidas e sem mistura entre tipos.
- Validação de regressão:
  - verificar logs novos de lock/parse/upsert e auditoria por aba para rastreabilidade.

4) Critérios de aceite
- Sincronização das abas de contas executa sem erro de lock.
- `accounts_payable_receivable` recebe dados de pagar e receber.
- `/accounts` deixa de exibir zero em Março/2026.
- Fluxo continua com **pagar e receber separados** no mesmo menu.
- Logs suficientes para diagnosticar rapidamente qualquer regressão futura.

Detalhes técnicos (resumo)
- Arquivos-alvo:  
  - `supabase/functions/sheets-sync-all-tabs/index.ts` (correção principal)  
  - `src/pages/GoogleSheetsPage.tsx` (roteamento de sync)  
  - `src/hooks/useGoogleSheets.ts` (feedback pós-sync)
- Sem mudança de schema obrigatória; foco em lógica e robustez operacional.
