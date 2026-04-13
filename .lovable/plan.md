

## Plano: Corrigir detecção de cartão Unicred (campo Conta ausente)

### Diagnóstico

O problema está na linha 197 da edge function `detect-credit-cards`:

```typescript
if (conta === "__no_conta__") continue;
```

As transações da Unicred não possuem o campo `raw_data.Conta` — usam `raw_data.Banco` com valor "UNICRED". Como `Conta` é null, todas são agrupadas sob `__no_conta__` e **descartadas antes de chegar às Layers 2 e 3**.

**Dados confirmados:**
- Março dia 23: 30 transações, 28 são merchant (CC real), 2 são PIX/TED
- Março dia 10: 32 transações, apenas 6 merchant (atividade bancária)
- Layer 3 funcionaria perfeitamente se as transações não fossem descartadas — dia 23 formaria 1 bloco candidato com 28+ merchant lines

### Correção

**Arquivo:** `supabase/functions/detect-credit-cards/index.ts`

**A. Usar `raw_data.Banco` como fallback para agrupamento**

Alterar a função de agrupamento para usar `raw_data.Banco` quando `raw_data.Conta` não existe:

```typescript
function getGroupKey(t: Transaction): string {
  const conta = getContaField(t);
  if (conta) return conta;
  const banco = t.raw_data?.Banco || t.raw_data?.banco || t.raw_data?.BANCO;
  if (banco) return String(banco).trim();
  return "__no_conta__";
}
```

**B. Remover skip cego de `__no_conta__`**

Trocar o `if (conta === "__no_conta__") continue;` por permitir que grupos sem Conta mas com Banco válido prossigam para Layer 2/3. Manter o skip apenas para `__no_conta__` real (sem Banco também).

**C. Expandir `extractCardLabel` para usar campo Banco**

Quando o label vem do campo Banco (não Conta), usar o nome do banco diretamente:

```typescript
// Se o grupo veio do campo Banco
if (groupSource === "banco") return `Cartão ${banco}`;
```

**D. Nenhuma alteração de threshold necessária**

A Layer 3 já funcionará corretamente:
- Dia 23: 28 merchant lines ≥ 10 → bloco candidato ✓
- Dia 10: ~6 merchant lines < 10 → descartado ✓
- candidateBlocks.length === 1 → aceito ✓

### Resultado esperado

- Unicred Março: ~28 transações detectadas como CC
- Fevereiro (80 no dia 23): ~70+ transações CC
- Card label: "Cartão UNICRED" ou "Cartão Unicred"

### Escopo

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/detect-credit-cards/index.ts` |

Apenas a lógica de agrupamento e o skip — sem alterações no frontend.

