

## Plano: Correção da Detecção de Cartão de Crédito + Seletor Multi-Cartão

### Diagnóstico Forense

A auditoria dos dados reais no banco revelou a causa raiz das 11 faturas espúrias:

**Contas na planilha:**
| Conta | Linhas | Natureza |
|-------|--------|----------|
| Banrisul 18 | 508 | Conta corrente bancária |
| Sicredi 34528-2 | 503 | Conta corrente bancária (com CC embutido dia 23) |
| Banco do Brasil | 168 | Conta dedicada de cartão de crédito |
| Sicredi 20171-5 | 63 | Conta poupança/auxiliar |
| Banrisul 06 | 35 | Conta auxiliar |

**Problema**: O algoritmo atual agrupa por `(data, banco)` e qualquer grupo com 3+ linhas vira "fatura". Como Banrisul 18 tem 22-34 linhas em muitos dias, e Sicredi 34528-2 tem 7-13 linhas diárias, dezenas de grupos falsos são criados como faturas de cartão.

**Realidade**: Existem exatamente 2 faturas/mês:
- **Banco do Brasil** (dia ~9): Conta dedicada, 30-60 linhas concentradas em uma única data (SHOPEE, Uber, FACEBK, APPLE)
- **Sicredi 34528-2** (dia 23): Bloco contíguo de ~14 linhas merchant (FACEBK, GOOGLE ADS, MAILCHIMP) embutido em uma conta bancária com PIX/transferências

### Novo Algoritmo de Detecção (3 camadas)

```text
Camada 1 (Explícita): "Fatura CC" no campo Conta → sem mudança
Camada 2 (Conta CC Dedicada): Conta onde 1 data concentra >60% das linhas e >80% são merchant
Camada 3 (Bloco CC Embutido): Dentro de conta bancária, sub-bloco contíguo de 5+ linhas merchant na mesma data
```

**Função `isMerchantLine(t)`**: Retorna `true` se a descrição NÃO contém PIX, TED, BOLETO, RECEBIMENTO, PAGAMENTO, TRANSFERENCIA, SALDO, RENDIMENTO, e `movement_type` != TRANSFER. Cobre transações típicas de CC (SHOPEE, Uber, FACEBK, IOF COMPRA, PARC).

**Exclusão forçada**: Contas com transações espalhadas em 10+ datas sem nenhuma data dominante com alto merchant_ratio são descartadas (ex: Banrisul 18).

### Mudanças na Edge Function

1. **Substituir o generic path** pelo novo algoritmo de 2 camadas:
   - **Camada 2**: Agrupar por (tab, conta). Para cada conta, calcular `concentration = max_date_count / total_in_tab`. Se concentration > 0.5 E max_date tem >15 linhas E merchant_ratio > 0.8 → toda a data dominante é uma fatura CC.
   - **Camada 3**: Para contas bancárias (concentration < 0.5), em cada data: se há 5+ linhas merchant contíguas (gap de row <= 2) → extrair como sub-bloco CC. Excluir PIX/TED/transfers do bloco.

2. **Merchant detection function**: Classificar cada linha como "merchant" ou "banking" antes do agrupamento.

3. **Manter camada 1** (Fatura CC explícita) sem alteração.

### Mudanças no Frontend

#### 1. Adicionar "Banco do Brasil" ao `cardCatalog.ts`

Novo brand com aliases `["banco do brasil", "bb"]`, cores azul/amarelo do BB.

#### 2. Seletor Multi-Cartão no Header

Quando há múltiplas `card_label` distintas no mesmo `period_key`, adicionar botões de alternância no `ConnectedHeader` para trocar entre os cartões (ex: "Sicredi" ↔ "Banco do Brasil"). O clique filtra os ciclos pelo `card_label` selecionado.

#### 3. Refatorar `CycleSelector`

Agrupar ciclos por `period_key` (mês). Dentro de cada mês, se há 2 cartões, mostrar sub-chips com ícone do banco. O seletor principal navega por mês, e o card-switcher alterna entre bancos no mesmo mês.

### Fluxo de dados esperado após a correção

```text
Jan/2026: BB (dia 08, ~66 linhas) + Sicredi (dia 23, ~16 linhas) = 2 faturas
Fev/2026: BB (dia 08, ~56 linhas) + Sicredi (dia 23, ~16 linhas) = 2 faturas  
Mar/2026: BB (dia 09, ~32 linhas) + Sicredi (dia 23, ~14 linhas) = 2 faturas
Abr/2026: Se houver dados = até 2 faturas
Total: 6-8 faturas (não 11+)
```

### Arquivos

| Acao | Arquivo |
|------|---------|
| Reescrever | `supabase/functions/detect-credit-cards/index.ts` (novo algoritmo 3 camadas) |
| Editar | `src/lib/cardCatalog.ts` (adicionar Banco do Brasil) |
| Editar | `src/pages/CreditCardPage.tsx` (card switcher por banco no mesmo mês) |
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` (botões de troca de cartão) |
| Editar | `src/components/credit-card/CreditCardCycleSelector.tsx` (agrupamento por mês) |

### Escopo restrito
- Zero novas tabelas ou migrações
- Zero alteração no pipeline de sync/importação
- Zero impacto em outros menus
- Mesma rota, mesmo payload, mesmas tabelas de persistência

