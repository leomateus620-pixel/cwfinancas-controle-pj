

## Plano: Suporte ao formato Banco do Brasil + correção OCR

### Problemas diagnosticados

1. **`unpdf` retorna 1 caractere** para este PDF do BB — extração de texto falha silenciosamente
2. **OCR falha com `SyntaxError: Unexpected end of JSON input`** — o `resp.json()` do gateway AI retorna resposta truncada/vazia e o catch não trata adequadamente
3. **`parseValue()` não entende `(+)` / `(-)`** — formato exclusivo do Banco do Brasil (ex: `6.151,75 (+)`)
4. **Regex não captura formato BB** — as linhas BB têm formato tabular multi-coluna com lote/documento que nenhum padrão atual reconhece

### Correções na Edge Function

**A. Suporte ao formato `(+)` / `(-)` no `parseValue()`**

Adicionar detecção de `(+)` e `(-)` como marcadores de crédito/débito antes de limpar o valor.

**B. Novo parser para formato Banco do Brasil**

Adicionar regex para capturar linhas no formato:
```
DD/MM/YYYY  lote  documento  Descrição  valor (+/-)
```
Extraído pelo `unpdf`/OCR como texto corrido: `02/03/2026 14397 10752029872392 Pix - Recebido 6.151,75 (+)`

Também capturar linhas com descrição multi-linha (BB quebra histórico em 2 linhas).

**C. Melhorar OCR — tratamento de resposta vazia/truncada**

- Verificar `resp.ok` antes de chamar `resp.json()`
- Usar `resp.text()` + `JSON.parse()` manual com try/catch mais granular
- Logar o conteúdo bruto quando parsing falha para diagnóstico
- Adicionar timeout no fetch para evitar respostas pendentes

**D. Fallback de extração: se `unpdf` retorna < 50 chars, tentar enviar direto para OCR com instruções mais específicas**

O prompt de OCR já funciona para extrair transações — o problema é que a resposta JSON está sendo truncada. Melhorar o prompt para pedir resposta mais compacta e adicionar retry.

**E. Adicionar `"banco do brasil"`, `"transferência enviada"`, `"pix - agendamento"`, `"pagamento de boleto"`, `"tarifa modulo"` aos BANK_KEYWORDS**

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/parse-pdf-statement/index.ts` |

### Resultado esperado com o PDF do BB

- Tipo: `bank`
- ~25 transações reais (excluindo "Saldo do dia", "Saldo Anterior", "S A L D O")
- Formato: Data DD/MM/YYYY | Descrição | Valor com sinal correto

