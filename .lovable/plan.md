# Conexão dedicada Sheets/Excel para Relatórios & Reuniões

## Objetivo
Adicionar uma conexão Google Sheets **isolada** para o card "Fontes da reunião", com seletor 3D de planilhas/abas, sem conflitar com a conexão financeira existente (Receitas/Despesas/DRE/Cartão). Também relocar a conexão Excel para este menu.

## Arquitetura — isolamento de contexto

Hoje `google_sheet_connections` é usada para o módulo financeiro. Para evitar conflito, vamos marcar as conexões deste menu com um **scope distinto**:

- Nova coluna `purpose text` em `google_sheet_connections` com default `'financial'`.
- Conexões criadas pelo menu Reuniões usam `purpose = 'meetings'`.
- Todos os hooks financeiros existentes (`useActiveConnection`, sync, DRE, etc.) passam a filtrar `purpose = 'financial'` (ou `IS NULL` por compatibilidade).
- O novo hook do menu reuniões filtra `purpose = 'meetings'`.
- OAuth Google é compartilhado (já usa `google_oauth_tokens` por usuário) — não há retrabalho de auth.

## Backend (migração única)

```sql
ALTER TABLE public.google_sheet_connections
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'financial';
CREATE INDEX IF NOT EXISTS idx_gsc_user_purpose
  ON public.google_sheet_connections(user_id, purpose);

-- Vínculo opcional: reunião -> planilha de contexto
ALTER TABLE public.meeting_sessions
  ADD COLUMN IF NOT EXISTS source_connection_id uuid,
  ADD COLUMN IF NOT EXISTS source_sheet_tabs jsonb DEFAULT '[]'::jsonb;
```

Nenhuma policy nova: RLS já é por `user_id`.

## Frontend

### 1. Novo componente `MeetingSourcePickerCard.tsx` (substitui `SourceSelectorCard`)
Card "Fontes da reunião" no `ReportsMeetingsPage`, com:
- Estado vazio: dois botões — **"Conectar Google Sheets"** e **"Importar Excel"**.
- Estado conectado: grid 3D (`ThreeDIconCard` style) com cada planilha como card glass — nome, ícone Sheets/Excel, contador de abas, ação "Trocar / Desconectar".
- Botão "+ Adicionar planilha" sempre visível.

### 2. Modal `MeetingSheetsPickerModal.tsx`
Reaproveita `google-sheets-list` (já lista Drive) e `google-sheets-auth` para OAuth:
- Passo 1: lista todas as planilhas do Drive do usuário em grid 3D (capas com gradiente, hover lift, badge de data de modificação).
- Passo 2: ao escolher uma planilha, mostra suas abas como chips selecionáveis (multi-select).
- Confirmar → cria linha em `google_sheet_connections` com `purpose='meetings'`, `sheet_name` = aba(s) escolhida(s) serializada(s).

### 3. Modal `MeetingExcelPickerCard` (reaproveita upload Excel)
Migra o fluxo Excel já existente (`parse-excel-upload`) para este menu — botão "Importar Excel" no card de fontes abre o mesmo modal já consolidado, mas grava metadata em `meeting_sessions.source_*` e/ou em `google_sheet_connections` com `purpose='meetings'` e tipo `excel_upload`.

### 4. Hook `useMeetingSources.ts`
```ts
useQuery(['meeting-sources', userId], () =>
  supabase.from('google_sheet_connections')
    .select('id, spreadsheet_id, spreadsheet_name, sheet_name, data_type, updated_at')
    .eq('user_id', userId)
    .eq('purpose', 'meetings')
)
```
Mutations: `connectSheet`, `disconnectSource`.

### 5. Atualizações nos hooks financeiros existentes
Adicionar `.or('purpose.eq.financial,purpose.is.null')` em:
- `src/hooks/useActiveConnection.ts`
- `src/hooks/useGoogleSheets.ts` (lista de conexões)
- Edge functions `google-sheets-sync`, `sheets-sync-all-tabs`, `scheduled-sync`, `dre-sync`, `reset-sheet-data` — filtros por `purpose='financial'` para evitar sync acidental das planilhas de reunião.

### 6. Integração com gravação
`useMeetingRecorder` ganha `attachedSources: { connectionId, tabs[] }` salvos em `meeting_sessions.source_connection_id` ao iniciar a sessão, dando contexto para o resumo IA pós-reunião.

## Design (Liquid Glass Premium)

```text
┌──────────────────────────────────────────────┐
│  Fontes da reunião       [+ Adicionar]       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 📊 Sheet │  │ 📈 Sheet │  │ 📗 Excel │    │
│  │ Vendas Q2│  │ DRE 2026 │  │ Reuniao  │    │
│  │ 3 abas   │  │ 12 abas  │  │ Upload   │    │
│  └──────────┘  └──────────┘  └──────────┘    │
└──────────────────────────────────────────────┘
```
Cards 3D: blur 24px, borda glow primary/30, hover -translate-y-1, ícone colorido por provedor (verde Sheets, azul Excel), capsule "X abas" em `tabular-nums`.

## Arquivos a criar/editar

**Criar**
- `src/features/reports-meetings/components/MeetingSourcePickerCard.tsx`
- `src/features/reports-meetings/components/MeetingSheetsPickerModal.tsx`
- `src/features/reports-meetings/components/MeetingSourceCard3D.tsx`
- `src/features/reports-meetings/hooks/useMeetingSources.ts`
- `supabase/migrations/*_meeting_sources_purpose.sql`

**Editar**
- `src/pages/ReportsMeetingsPage.tsx` — trocar `SourceSelectorCard` pelo novo card
- `src/features/reports-meetings/hooks/useMeetingRecorder.ts` — anexar fontes à sessão
- `src/hooks/useActiveConnection.ts`, `src/hooks/useGoogleSheets.ts` — filtrar `purpose='financial'`
- Edge functions de sync financeiro — filtro `purpose='financial'`

**Remover**
- `src/features/reports-meetings/components/SourceSelectorCard.tsx` (substituído)

## Garantias
- Conexão financeira em uso permanece intocada (todas existentes recebem `purpose='financial'` no default).
- Conexões de reunião nunca entram nos jobs de sync financeiro.
- OAuth Google é único por usuário — não pede reautenticação.
- Excel: mesmo parser já consolidado, apenas redirecionado para este menu.
