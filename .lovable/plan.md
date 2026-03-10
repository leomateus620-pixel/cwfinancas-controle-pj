

## Plano: Corrigir falso positivo de "linhas faltando" na auditoria

### Problema

A auditoria mostra "2 linhas faltando" e status "FALHA" para a aba Março, mas na realidade essas 2 linhas são **noOps** — linhas que já existiam no banco com conteúdo idêntico e não precisaram ser atualizadas. Todos os 15 registros com valor estão corretamente no banco de dados.

O cálculo atual: `diff = rows_with_value - rows_imported` não considera noOps.

O cálculo correto: `diff = rows_with_value - rows_imported - noOps`.

### Mudanças

**1. `src/components/sheets/SyncAuditTable.tsx`**
- Extrair `noOps` de `audit.skip_reasons.noOps` (já disponível no campo `skip_reasons`)
- Ajustar o cálculo do diff por aba: `diff = rows_with_value - rows_imported - (skip_reasons.noOps || 0)`
- Ajustar o cálculo do total para incluir noOps acumulados
- Manter a lógica de status: diff === 0 → OK, diff > 0 → FALHA

Isso corrige o problema para todas as importações futuras e existentes, pois o valor de `noOps` já é gravado no campo `skip_reasons` pelo motor de sincronização.

