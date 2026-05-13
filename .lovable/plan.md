## Problema

A correção anterior só pegou o caminho de PDF. Arquivos Excel (.xls/.xlsx) percorrem um branch separado em `parse-pdf-statement/index.ts` que retorna em ~linha 763 **antes** do bloco de inversão (linha ~875). Por isso a planilha Sicredi ainda mostra compras positivas e `Pagamento` negativo.

## Mudança

`supabase/functions/parse-pdf-statement/index.ts` — dentro do branch de Excel, **antes** do insert em `pdf_parsed_transactions` (entre as linhas 762 e 763), adicionar:

```ts
// Convenção CC: gastos negativos, estornos/pagamentos positivos.
if (detectedType === "credit_card") {
  for (const t of transactions) {
    if (typeof t.amount === "number" && t.amount !== 0) {
      t.amount = -t.amount;
    }
  }
}
```

Resultado: tanto o insert quanto o `transactions` retornado para o preview já saem com sinal correto.

## Fora de escopo

- Branch de PDF continua usando o bloco existente da linha 875 (sem duplicação de comportamento — cada branch tem o seu).
- `original_amount` permanece absoluto.
- Extratos bancários (`bank`) não sofrem inversão.

## Validação

Reenviar a mesma planilha Sicredi e conferir no preview:
- `UBER`, `IFOOD`, `APPLE…` → **negativos**
- `Pagamento` → **positivo**