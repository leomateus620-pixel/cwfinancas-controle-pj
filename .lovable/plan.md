

# Corrigir erro "cell.trim is not a function" no edge function

## Problema

O erro `cell.trim is not a function` ocorre na linha 830 do edge function `sheets-sync-all-tabs/index.ts`. Quando a planilha e um arquivo `.xlsx`, o parser SheetJS retorna valores numericos como `number`, nao como `string`. Chamar `.trim()` diretamente em um numero causa o erro em TODAS as linhas que contem dados numericos -- resultando em 9489 erros e 0 importacoes.

## Causa raiz

```text
// Linha 830 - PROBLEMA: cell pode ser number, boolean, Date...
const hasAnyContent = row.some(cell => cell && cell.trim().length > 0);

// Linha 827 - PROBLEMA: row[i] || "" descarta valores 0 e false (dados validos)
headers.forEach((h, i) => { rowObj[h] = row[i] || ""; });
```

## Correcao

Duas linhas precisam ser corrigidas no arquivo `supabase/functions/sheets-sync-all-tabs/index.ts`:

| Linha | Antes | Depois |
|---|---|---|
| 827 | `rowObj[h] = row[i] \|\| ""` | `rowObj[String(h)] = row[i] ?? ""` |
| 830 | `cell && cell.trim().length > 0` | `cell !== null && cell !== undefined && String(cell).trim().length > 0` |

## Detalhe tecnico

### Linha 827 -- preservar valores `0` e normalizar headers

```text
// ANTES:
headers.forEach((h, i) => { rowObj[h] = row[i] || ""; });

// DEPOIS:
headers.forEach((h, i) => { rowObj[String(h)] = row[i] ?? ""; });
```

- `String(h)` garante que headers numericos virem string
- `??` ao inves de `||` preserva valores `0` e `false` que sao dados financeiros validos

### Linha 830 -- converter para string antes de chamar trim

```text
// ANTES:
const hasAnyContent = row.some(cell => cell && cell.trim().length > 0);

// DEPOIS:
const hasAnyContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim().length > 0);
```

- `String(cell)` converte numeros, booleans e datas para string antes de chamar `.trim()`
- Checagem explicita de `null`/`undefined` evita converter esses valores para "null"/"undefined"

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Corrigir linhas 827 e 830 |

## Impacto

Essa correcao resolve o erro em todas as 9489+ linhas que estavam falhando. As linhas passarao a ser processadas normalmente pelo parser de transacoes (data, descricao, valor, categoria).
