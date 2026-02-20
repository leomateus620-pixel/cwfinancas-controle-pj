

# Corrigir ano incorreto na deteccao de abas mensais

## Problema

A funcao `detectMonthFromTab()` no `SpreadsheetSelectorModal.tsx` usa `new Date().getFullYear()` (2026) como ano padrao quando o nome da aba nao contem ano explicito (ex: "Janeiro" em vez de "Janeiro 2025"). Resultado: todas as abas aparecem como "Janeiro 2026", "Fevereiro 2026" etc., mesmo quando os dados sao de 2025.

## Solucao

Adicionar um **seletor de ano** ao step "select-tabs". O usuario escolhe o ano (padrao: ano corrente) e os periodKeys e labels sao recalculados automaticamente. Isso resolve o problema sem depender de heuristicas frageis de inferencia.

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/components/modals/SpreadsheetSelectorModal.tsx` | Adicionar seletor de ano + recalcular periodKeys quando o ano muda |

## Detalhes tecnicos

### 1. Novo estado para o ano selecionado

```text
const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
```

### 2. Refatorar detectMonthFromTab para nao definir ano padrao

A funcao passara a retornar `year: null` quando o nome da aba nao contem ano. O ano sera preenchido pelo `selectedYear` no momento da construcao dos `detectedMonths`.

```text
// detectMonthFromTab retorna year como number | null
function detectMonthFromTab(tabName: string): { monthIndex: number; year: number | null } | null {
  // ... regex matching ...
  // Se match[1] existe, calcula o ano
  // Senao, retorna year: null
}
```

### 3. Recalcular detectedMonths quando selectedYear muda

O useEffect que constroi `detectedMonths` passara a usar `selectedYear` como fallback quando `year` for null:

```text
useEffect(() => {
  if (sheetsData?.sheets) {
    const months = [];
    for (const sheet of sheetsData.sheets) {
      const detected = detectMonthFromTab(sheet.title);
      if (detected) {
        const year = detected.year ?? selectedYear;
        const pk = year + "-" + String(detected.monthIndex).padStart(2, "0");
        months.push({ periodKey: pk, label: MONTH_LABELS[detected.monthIndex] + " " + year, ... });
      }
    }
    // ...
  }
}, [sheetsData, selectedYear]);
```

### 4. Inferir ano inicial a partir do nome da planilha

Ao selecionar a planilha, tentar extrair o ano do nome (ex: "Controle Financeiro 2025"):

```text
const yearMatch = spreadsheetName.match(/\b(20\d{2})\b/);
if (yearMatch) setSelectedYear(parseInt(yearMatch[1]));
```

Se nenhum ano for encontrado no nome, manter o ano corrente como padrao.

### 5. UI do seletor de ano no step "select-tabs"

Acima do grid de meses, adicionar um Select simples:

```text
<div className="flex items-center gap-2">
  <Calendar className="w-4 h-4" />
  <span>Ano:</span>
  <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
    <SelectTrigger className="w-28">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Isso permite que o usuario rapidamente troque para 2025 e veja todos os meses atualizados.

### 6. Abas que JA possuem ano no nome

Se uma aba se chama "Jan/25", o regex ja extrai `year = 2025`. Nesse caso, o `year` retornado NAO e null, entao o seletor de ano nao afeta essa aba -- ela sempre mostrara 2025 independentemente do seletor.

