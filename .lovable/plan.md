## Objetivo

No Conversor de Extratos, quando o documento for `credit_card`, **inverter o sinal** de todas as transações antes de salvar/exibir:
- Gastos (atualmente positivos) → **negativos**
- Estornos / pagamentos / créditos (atualmente negativos) → **positivos**

Isso alinha o conversor à mesma convenção já usada em todos os desmembramentos de cartão de crédito do app (faturas, dashboards, categorias).

## Mudança

### `supabase/functions/parse-pdf-statement/index.ts`

Adicionar um único passo de pós-processamento, **logo após** a normalização VERO (linha ~871) e **antes** do `console.log("Final: ...")` e do insert em `pdf_parsed_transactions`:

```ts
// Convenção CC: gastos negativos, estornos/pagamentos positivos.
// Aplica-se SOMENTE quando o documento foi classificado como credit_card.
if (detectedType === "credit_card") {
  for (const t of transactions) {
    if (typeof t.amount === "number" && t.amount !== 0) {
      t.amount = -t.amount;
    }
    // original_amount permanece sempre |valor| (já é assim no parser).
  }
}
```

Por que aqui:
- É o único ponto onde todas as ramificações (Excel estruturado, PDF estruturado, fallback texto, OCR-AI, fallback genérico) já convergiram para `transactions[]`.
- Garante que `pdf_parsed_transactions.amount` seja gravado já com o sinal correto, e o preview na UI usa esse mesmo array — não precisa tocar no frontend.
- `original_amount` continua absoluto (sem mexer), preservando compat.

### Fora de escopo / não quebra
- Documentos `bank` (extratos): **não** sofrem inversão — mantêm a convenção atual (positivo = entrada, negativo = saída).
- Detector principal de cartão de crédito do dashboard (`detect-credit-cards`): **não** alterado — a convenção lá já é a esperada.
- Schema, RLS, exports CSV/Excel, contadores e UI: nada muda além do sinal já vir invertido nos dados.
- Regra VERO (maquininha = entrada positiva) continua aplicada antes da inversão; como VERO só ocorre em extratos bancários, não há conflito com a inversão de CC.

## Validação manual
1. Subir novamente a planilha Sicredi do teste anterior.
2. Conferir na tabela do preview:
   - Compras (ex.: `UBER`, `IFOOD`) aparecem **negativas**.
   - `Pagamento` / estornos aparecem **positivos**.
3. Conferir um PDF de extrato bancário comum: sinais permanecem como antes (sem inversão).
