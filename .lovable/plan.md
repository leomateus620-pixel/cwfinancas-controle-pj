
# Corrigir: DRE nao exibe dados por causa do filtro global de datas

## Problema Encontrado

A pagina DRE nao mostra nenhum dado apesar da importacao ter sido bem-sucedida (188 linhas, 1 periodo).

**Causa raiz:** O hook `useDRE.ts` filtra os periodos disponiveis usando o `globalMonthRange` do contexto de datas. O usuario tem o filtro global configurado para **Fevereiro 2026** (2026-02-01 a 2026-02-28), mas o unico periodo DRE importado e **Janeiro 2026** (`period_key: "2026-01"`). Como `"2026-01" < "2026-02"`, o periodo e excluido pelo filtro e `periodOptions` fica vazio -- sem seletor de periodo, sem linhas, sem KPIs.

## Solucao

Remover o filtro `globalMonthRange` do hook `useDRE`. A DRE e um demonstrativo financeiro independente -- cada periodo (mes) e selecionado pelo proprio dropdown da pagina DRE, nao pelo filtro global do dashboard.

## Arquivo Modificado

| Arquivo | Acao |
|---|---|
| `src/hooks/useDRE.ts` | Remover a logica de filtragem por `globalMonthRange` nos `periodOptions` |

## Detalhe Tecnico

No arquivo `src/hooks/useDRE.ts`, linhas 65-79, o codigo atual:

```text
let globalMonthRange = null;
try {
  const dr = useDateRange();
  globalMonthRange = dr.monthRange;
} catch { }

const periodOptions = (periods || [])
  .filter(p => {
    if (!globalMonthRange) return true;
    if (p.period_key === "TOTAL") return true;
    if (p.period_key.startsWith("REVIEW_")) return true;
    return p.period_key >= globalMonthRange.from && p.period_key <= globalMonthRange.to;
  })
  .map(...)
```

Sera simplificado para remover o filtro, mostrando TODOS os periodos importados no dropdown da DRE:

```text
const periodOptions = (periods || [])
  .map(p => ({
    key: p.period_key,
    label: p.period_label || p.period_key,
    id: p.id,
    validationStatus: p.validation_status,
    templateType: p.template_type || "DEFAULT",
  }));
```

A chamada a `useDateRange()` e a variavel `globalMonthRange` serao removidas do hook.
