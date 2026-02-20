

# Corrigir KPIs da DRE LCF: Resultado e Despesas Consistentes

## Problema Principal

O parser LCF marca TODAS as linhas contendo "resultado" com a mesma secao `RESULTADO`. Na planilha LCF existem pelo menos duas linhas de resultado:

1. **"Resultado antes das despesas escritorio"** -- resultado parcial (receita - despesas nucleo apenas)
2. **"RESULTADO antes das participacoes e reserva"** -- resultado FINAL (apos todas as despesas)

Como `findBySection("RESULTADO")` retorna o PRIMEIRO match, o KPI "Resultado do Mes" mostra o valor ANTES do escritorio, enquanto "Despesas Totais" ja INCLUI escritorio. Isso gera inconsistencia.

## Solucao

Criar secoes distintas no parser para diferenciar os dois tipos de resultado:

| Rotulo na planilha | Secao atual | Secao corrigida |
|---|---|---|
| "Resultado antes das despesas escritorio" | RESULTADO | RESULTADO_PRE_ESCRITORIO |
| "RESULTADO antes das participacoes e reserva" | RESULTADO | RESULTADO_FINAL |
| Qualquer outro "resultado" generico | RESULTADO | RESULTADO |

O KPI "Resultado do Mes" passara a usar `RESULTADO_FINAL` (prioridade) ou fallback para `RESULTADO`.

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/dre-sync/index.ts` | Corrigir `detectSection()` para diferenciar RESULTADO_PRE_ESCRITORIO vs RESULTADO_FINAL |
| `src/hooks/useDRE.ts` | Corrigir `calculateLcfKPIs()` para buscar RESULTADO_FINAL |

## Detalhes Tecnicos

### 1. Edge Function: `detectSection()` (linha ~290)

```text
// ANTES:
if (n.includes("resultado")) return "RESULTADO";

// DEPOIS:
if (n.includes("resultado") && n.includes("antes") && n.includes("despesas") && n.includes("escritorio")) 
  return "RESULTADO_PRE_ESCRITORIO";
if (n.includes("resultado") && n.includes("participac")) 
  return "RESULTADO_FINAL";
if (n.includes("resultado")) 
  return "RESULTADO";
```

A ordem importa: regras mais especificas primeiro.

### 2. Edge Function: `validateDreLcf()` (linha ~446)

Ajustar a validacao para usar `RESULTADO_FINAL` na reconciliacao:

```text
// Buscar resultado final (prioridade) ou fallback generico
const resultado = findBySection("RESULTADO_FINAL") || findBySection("RESULTADO");
```

Adicionar validacao extra:
- `resultado_final` deve ser aproximadamente igual a `receita_bruta + despesas_nucleo + despesas_escritorio` (tolerancia 0.01)

### 3. Hook: `calculateLcfKPIs()` (linha ~207)

```text
// ANTES:
const resultado = findBySection("RESULTADO");

// DEPOIS:
const resultado = findBySection("RESULTADO_FINAL") || findBySection("RESULTADO");
```

Isso garante que o KPI "Resultado do Mes" use o resultado APOS escritorio, consistente com "Despesas Totais" que ja soma escritorio.

### 4. Validacao dos valores esperados

Com a correcao, para "DRE Jan26":
- Faturamento (RECEITA_BRUTA subtotal consolidado) = 69.384,18
- Despesas nucleo (DESPESAS_NUCLEO subtotal consolidado) = valor negativo
- Despesas escritorio (DESPESAS_ESCRITORIO subtotal) = valor negativo  
- Despesas Totais = despesas_nucleo + despesas_escritorio = -16.421,84
- Resultado (RESULTADO_FINAL subtotal consolidado) = 52.962,34
- Margem = 52.962,34 / 69.384,18 * 100 = 76,33%

A reconciliacao verifica: 69.384,18 + (-16.421,84) = 52.962,34 (ok, diff = 0)

