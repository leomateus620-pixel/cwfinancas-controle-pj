

# Adicionar card "Folego de Caixa" de volta na Home

## Problema

O card "Folego de Caixa" existe no codigo (linha 132-145 de `HomePage.tsx`), mas esta envolvido em uma condicao que o esconde quando `runwayDays` e `null` ou `0`. Isso faz com que ele nao apareca na maioria dos cenarios.

## Solucao

Remover a condicao `{data.runwayDays !== null && data.runwayDays !== 0 && (...)}` para que o card seja sempre exibido, tratando os valores especiais na apresentacao:

- `runwayDays === null` (sem despesas): exibir "infinito" com cor verde
- `runwayDays === 0` (caixa zerado/negativo): exibir "0 dias" com cor vermelha
- Demais valores: manter logica atual de cores (> 60 verde, > 30 amarelo, demais vermelho)

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/pages/HomePage.tsx` | Remover condicional do card Folego de Caixa para que apareca sempre |

