# Plano — Suporte real a .xlsx em /relatorios-reunioes

## Diagnóstico

O erro acontece em `MeetingSheetsPickerModal.pickSpreadsheet`: ao clicar numa planilha, o front chama `google-sheets-list` com `spreadsheet_id`, que rejeita qualquer mimeType ≠ `application/vnd.google-apps.spreadsheet` e devolve 400 com `unsupported_mime`. A função `google-read-sheet-preview` já trata os dois casos (Sheets nativo e .xlsx via Drive + xlsx) e retorna `{ spreadsheet, sheets, preview, request_id }`. A correção essencial é trocar a função usada para carregar as abas. Os demais itens do pedido (pipeline real `reports-meetings-generate`, modo `full`, novo contrato `workbook`) podem ser feitos sem quebrar nada, mas o critério de aceite é destravado só com a troca no modal.

## Mudanças

### 1. `MeetingSheetsPickerModal.tsx` (núcleo do fix)
- Em `pickSpreadsheet`, trocar `google-sheets-list` por `google-read-sheet-preview` com body `{ spreadsheetId: s.id }`.
- Remover o ramo `unsupported_mime` / toast "Arquivo não suportado".
- Ler `payload.sheets` (mesmo formato `{ sheet_id, title, index }`) e `payload.spreadsheet.name` para refresh do nome.
- Mensagens de status novas: "Excel no Drive detectado" / "Abas carregadas" quando `payload.spreadsheet.mimeType === XLSX_MIME` (ver item 2).
- Em caso de erro real, mostrar `code` + `request_id` no toast.

### 2. `google-read-sheet-preview/index.ts`
- Aceitar também `sheetNames: string[]` e `mode: "preview" | "full"` no body (default `preview`).
- Retornar no payload:
  - `spreadsheet: { id, name, mimeType, provider }` onde `provider` = `google_sheets` ou `drive_xlsx`.
  - Continuar retornando `sheets` e `preview` como hoje (compatível).
  - Quando `sheetNames` for enviado, retornar também `workbook: { sourceName, provider, sheets: [{ name, rows }] }` com as abas pedidas. No modo `full`, sem o cap de 20 linhas / Z (usar `sheetRows` maior, ex. 5000, sem limitar `decoded.e.c`); no modo `preview`, manter o cap atual.
  - Para Sheets nativo no modo full: chamar `values` por aba sem limite Z (ex. `'aba'!A1:ZZ`).
  - Para .xlsx: ler o workbook uma vez e iterar `sheetNames`.

### 3. `google-list-sheets/index.ts`
- Incluir `mimeType` no `files(...)` da query Drive.
- Mapear `provider` no item devolvido: `mimeType === XLSX_MIME ? "drive_xlsx" : "google_sheets"`.
- Sem mudanças de contrato; campos adicionais.

### 4. Lista de planilhas (UI no mesmo modal)
- Mostrar pequeno chip "Excel" para `provider === "drive_xlsx"` (cor azul) e "Sheets" (verde). Sem novo modal.

### 5. `useMeetingSources.ts`
- `connectSheet` passa a aceitar `provider`. Gravar `data_type`:
  - `google_sheets` → mantém `google_sheets`
  - `drive_xlsx` → `drive_xlsx`
- `purpose: "meetings"` preservado. `parseTabs` e `provider` no SELECT já reconhecem `drive_xlsx` (ajustar a união do tipo).

### 6. `sourceAdapters.readSheetSource`
- Enviar `{ spreadsheetId, sheetNames, mode: "full" }`.
- `previewToWorkbookSnapshot` já cobre o formato; quando `payload.workbook` vier do backend, usar direto e pular conversão.

### 7. `useReportGeneration`
- Não chamar `reports-meetings-generate` (é placeholder). Caminho principal: para cada source vinculada → `readSheetSource(..., mode:"full")` → `buildPreMeetingReportFromWorkbook`.
- AuditLog identifica origem por `source.provider`: "Google Sheets nativo", "Excel .xlsx no Drive", ou "fixture/fallback".
- Fixture só com `forceFixture` ou se todas as fontes falharem.

### 8. `reports-meetings-generate`
- Deixar como está (placeholder) e remover sua invocação do front (item 7). Sem deploy necessário.

### 9. Testes
- Unit: estender `sourceAdapters` tests cobrindo `workbook` direto do backend e fallback.
- E2E (`e2e/reports-meetings.spec.ts`): adicionar caso "selecionar .xlsx → abas → vincular → gerar relatório" usando mock da edge function.

## Deploys necessários
- `google-read-sheet-preview` (novo contrato com `sheetNames`/`mode`/`workbook`/`provider`).
- `google-list-sheets` (adicionar `mimeType`/`provider`).
- `google-sheets-list` permanece, mas não é mais chamado pelo módulo de reuniões.

## Critério de aceite
Selecionar "Financeiro GR - 2026.xlsx" no modal carrega as abas via `google-read-sheet-preview`, deixa selecionar, vincula como `drive_xlsx` com `purpose=meetings`, e a geração do relatório lê o workbook em modo full sem passar pela função placeholder e sem o toast "Arquivo não suportado".
