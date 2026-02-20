
# Seletor de abas com multi-select (clique para selecionar meses)

## Problema

Ao clicar em "Todas as Abas", o fluxo atual pede um intervalo de meses (de/ate) que nem sempre funciona corretamente -- especialmente quando o ano inferido da planilha nao bate com o ano do filtro. Alem disso, o usuario nao tem controle granular sobre quais abas importar.

## Solucao

Substituir o step "month-range" (selecionar de/ate) por um step de **multi-select visual** onde cada aba mensal detectada aparece como um chip/botao clicavel. O usuario clica nos meses que deseja importar e ve quais estao selecionados (highlight azul). Botoes de atalho "Selecionar Todos" e "Limpar" facilitam a operacao.

No backend, ao inves de enviar `month_range: { from, to }`, enviaremos a lista exata de `periodKeys` selecionados, e o edge function filtrara diretamente por esses valores.

## Fluxo do usuario (novo)

```text
1. Seleciona planilha
2. Ve lista de abas
3. Clica "Todas as Abas" (ou seleciona abas individuais -- futuro)
4. Ve grid de meses detectados com checkboxes/chips clicaveis
5. Clica nos meses desejados (toggle on/off, highlight azul)
6. Clica "Continuar"
7. Confirma e importa
```

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/components/modals/SpreadsheetSelectorModal.tsx` | Substituir step "month-range" (selects de/ate) por grid de chips clicaveis com multi-select |
| `src/hooks/useGoogleSheets.ts` | Alterar `syncAllTabs` e `createConnection` para aceitar `selectedTabs: string[]` (lista de periodKeys) ao inves de `monthRange: {from, to}` |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Aceitar novo campo `selected_tabs: string[]` no request body e filtrar abas por esse array (com fallback para `month_range` por compatibilidade) |
| `src/pages/GoogleSheetsPage.tsx` | Atualizar `handleSync` para passar `selectedTabs` da connection ao inves de `monthRange` |

## Detalhes tecnicos

### 1. SpreadsheetSelectorModal -- step "month-range" vira "select-tabs"

Substituir os dois `<Select>` (mes inicial / mes final) por um grid de chips clicaveis:

```text
// Estado: Set de periodKeys selecionados
const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());

// Ao detectar meses, pre-selecionar todos
useEffect(() => {
  if (detectedMonths.length > 0) {
    setSelectedPeriods(new Set(detectedMonths.map(m => m.periodKey)));
  }
}, [detectedMonths]);

// Toggle individual
const togglePeriod = (pk: string) => {
  setSelectedPeriods(prev => {
    const next = new Set(prev);
    next.has(pk) ? next.delete(pk) : next.add(pk);
    return next;
  });
};

// UI: grid 3 colunas com chips
detectedMonths.map(m => (
  <button
    key={m.periodKey}
    onClick={() => togglePeriod(m.periodKey)}
    className={cn(
      "p-3 rounded-xl border text-sm font-medium transition-all",
      selectedPeriods.has(m.periodKey)
        ? "border-primary bg-primary/10 text-primary"
        : "border-border/50 text-muted-foreground hover:border-primary/30"
    )}
  >
    <CheckCircle size if selected /> {m.label}
  </button>
))
```

Botoes de atalho: "Selecionar Todos" | "Limpar Selecao"

O `onCreateConnection` passara `selectedTabs: Array.from(selectedPeriods)` ao inves de `monthRange`.

### 2. Interface e hook (useGoogleSheets)

- `createConnection`: trocar campo `monthRange` por `selectedTabs: string[]` no `column_mapping` da connection
- `syncAllTabs`: trocar `monthRange` por `selectedTabs` no body enviado ao edge function

```text
// column_mapping salvo na connection:
{ selected_tabs: ["2026-01", "2026-02"] }

// Body enviado ao edge function:
{ connection_id: "...", selected_tabs: ["2026-01", "2026-02"] }
```

### 3. Edge Function (sheets-sync-all-tabs)

Adicionar suporte a `selected_tabs` no request:

```text
interface SyncAllTabsRequest {
  connection_id: string;
  month_range?: { from: string; to: string };   // mantido para compatibilidade
  selected_tabs?: string[];                       // NOVO: lista exata de periodKeys
}

// Filtragem:
if (selected_tabs && selected_tabs.length > 0) {
  // Comparar pelo mes (MM) para evitar mismatch de ano
  const selectedMonths = new Set(selected_tabs.map(pk => pk.slice(-2)));
  monthlyTabs = monthlyTabs.filter(t => {
    if (!t.monthIndex) return false;
    return selectedMonths.has(String(t.monthIndex).padStart(2, "0"));
  });
} else if (month_range) {
  // fallback antigo (compatibilidade)
  ...
}
```

### 4. GoogleSheetsPage -- handleSync

Atualizar para ler `selected_tabs` do `column_mapping` da connection:

```text
const handleSync = (connection) => {
  if (connection.data_type === "all_tabs") {
    const selectedTabs = connection.column_mapping?.selected_tabs;
    const monthRange = connection.column_mapping?.month_range;
    syncAllTabs.mutate({
      connectionId: connection.id,
      selectedTabs,   // novo
      monthRange,      // fallback
    });
  } else {
    syncData.mutate(connection.id);
  }
};
```

### 5. Compatibilidade

- Connections existentes que ja tenham `month_range` no `column_mapping` continuarao funcionando via fallback no edge function
- Novas connections salvarao `selected_tabs` no `column_mapping`
- O edge function aceita ambos os formatos, priorizando `selected_tabs` quando presente
