

## Plano: Parser de Contas a Receber por Contrato (Layout Vertical)

### Diagnóstico

A aba "Contas a Receber" tem duas seções distintas:

1. **Topo (linhas 1-20)**: Tabela-resumo horizontal (meses como colunas, clientes como linhas) — SEM status, SEM detalhes
2. **Blocos de contrato (imagem do usuário)**: Layout vertical onde cada contrato tem "Total contrato: R$ XX.XXX,00" seguido de linhas mensais com [mês/ano, forma pgto, valor, status]

O parser atual detecta "horizontal_monthly" por causa dos meses na primeira linha e lê apenas a tabela-resumo. Resultado: 
- "CLIENTE" (header) importado como dados com totais errados
- Nenhum status capturado (`status_raw: null` em todos)
- Dados da seção de contratos completamente ignorados
- Casarin aparece com apenas 4 meses (resumo) em vez de 18 (contratos)

### Solução

Criar um novo parser `parseAPRContractVertical` e ajustar a detecção de layout:

**1. Detecção de layout (`detectAPRLayout`)**
- Scanear todas as linhas procurando "total contrato" — se encontrar ≥2 ocorrências, classificar como `"contract_vertical"`
- Para receivable, priorizar contract_vertical sobre horizontal_monthly

**2. Novo parser `parseAPRContractVertical`**
```text
Lógica por bloco:
1. "Total contrato:" → marca início de novo bloco, skip da linha
2. Linha com texto em col_0 que não é mês → nome do contrato (counterpart)
3. Linhas com mês detectado (mai. 2025, jun. 2025) → dados:
   - Extrai month/year → period_key
   - Busca amount (parseBRL)
   - Busca payment_method (Boleto, Pix, etc.)
   - Busca status (Pago, A pagar, emitir, etc.)
4. Linha vazia entre blocos → reset
```

**3. Extração por linha de dados:**
- Percorre cada célula da linha
- `detectMonthFromText` → month/year para period_key e due_date
- `parseBRL` → amount (primeiro valor monetário encontrado)
- Keywords de pagamento → payment_method
- Keywords de status → status_raw + normalização existente
- Counterpart = nome do contrato do bloco atual

**4. Skips:**
- "Total contrato:" → skip (é subtotal)
- Linhas vazias → skip
- Linhas que são totais gerais → skip (via `isAPRSkippableRow`)

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Nova função `parseAPRContractVertical`, ajustar `detectAPRLayout` para detectar contract_vertical, ajustar `parseAPRTab` para rotear |

### Impacto
- Não quebra o parser de Contas a Pagar (que é horizontal e funciona corretamente)
- Não quebra o layout vertical genérico existente
- Apenas o RECEIVABLE com blocos de contrato será roteado ao novo parser

