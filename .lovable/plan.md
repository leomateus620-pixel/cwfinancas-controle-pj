

# Remover Dados Conflitantes (2026) e Manter Apenas 2025

## Problema
Existem 277 transacoes de outra planilha (abas "Janeiro" e "Fevereiro", ano 2026) misturadas com os dados legitimos de 2025. Isso causa valores incorretos no dashboard.

## O que sera removido

| Fonte | Ano | Qtd | Total (R$) |
|---|---|---|---|
| Aba "Janeiro" | 2026 | 270 | 206.221 |
| Aba "Fevereiro" | 2026 | 5 | 19.015 |
| Manual (sem aba) | 2026 | 2 | 101.000 |
| **Total removido** | | **277** | **326.237** |

## O que permanece (intacto)

| Fonte | Ano | Qtd |
|---|---|---|
| JAN/25 | 2025 | 26 |
| Julho | 2025 | 100 |
| Agosto | 2025 | 108 |
| Setembro | 2025 | 121 |
| Outubro | 2025 | 107 |
| **Total mantido** | | **462** |

## Implementacao

Uma unica operacao SQL para deletar todas as transacoes com data em 2026:

```sql
DELETE FROM transactions
WHERE EXTRACT(YEAR FROM date) = 2026;
```

Tambem sera necessario limpar `transaction_flags` associados a essas transacoes (se existirem) para evitar registros orfaos.

Apos a exclusao, os dados de `financial_daily_aggregates` de 2026 tambem serao removidos para manter consistencia.

## Impacto
- Dashboard passara a mostrar apenas dados de 2025
- KPIs, graficos e filtros refletirao somente o periodo correto
- Nenhuma tabela nova, nenhuma edge function alterada
