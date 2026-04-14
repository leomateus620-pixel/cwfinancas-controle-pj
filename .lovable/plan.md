

## Plano: Corrigir sinal das transações VERO (POS/maquininha)

### Problema

As transações VERO (ANT BLF, DEB BLF, CRE BLF, BANRICOMPRAS A VISTA) são **receitas** — dinheiro recebido via maquininha de cartão. Porém, o OCR da IA está interpretando como débitos (negativos).

Os dados no banco confirmam: todas as VERO estão com `amount` negativo, quando deveriam ser positivos.

### Causa raiz

1. O parser regex (`banrisulRe`) provavelmente não está capturando essas linhas (caindo no fallback OCR)
2. O prompt OCR não instrui a IA que "VERO" = recebimento POS = positivo
3. Não há pós-processamento para corrigir o sinal de transações VERO

### Solução

**Arquivo: `supabase/functions/parse-pdf-statement/index.ts`**

#### 1. Adicionar VERO ao prompt OCR
Incluir no prompt: "Transações com prefixo VERO (VERO ANT BLF, VERO DEB BLF, VERO CRE BLF, VERO BANRICOMPRAS) são recebimentos via maquininha de cartão — devem ter amount POSITIVO."

#### 2. Pós-processamento de sinal VERO
Após o parsing (tanto regex quanto OCR), adicionar uma verificação: se a `description` começa com `VERO` e o `amount` é negativo, inverter o sinal para positivo. Padrões: `VERO ANT`, `VERO DEB`, `VERO CRE`, `VERO BANRICOMPRAS`.

```typescript
// Após o parsing, corrigir sinais VERO
const VERO_POSITIVE_RE = /^VERO\s+(ANT|DEB|CRE|BANRICOMPRAS)/i;
for (const t of transactions) {
  if (VERO_POSITIVE_RE.test(t.description) && t.amount < 0) {
    t.amount = Math.abs(t.amount);
  }
}
```

#### 3. Reprocessar uploads existentes
Após deploy, o usuário pode reenviar o PDF para obter os valores corretos.

### Resultado esperado
- `VERO ANT BLF` → +3.044,21 (positivo)
- `VERO BANRICOMPRAS A VISTA` → +368,91 (positivo)
- Todos os recebimentos VERO corretamente como entrada

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/parse-pdf-statement/index.ts` |

