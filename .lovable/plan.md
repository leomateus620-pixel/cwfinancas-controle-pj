

# Corrigir Listagem de Planilhas Compartilhadas no Google Drive

## Diagnostico

Apos analisar o codigo, identifiquei **3 problemas** que impedem a listagem de planilhas compartilhadas:

### Problema 1: Scope OAuth insuficiente
O arquivo `google-sheets-auth/index.ts` (linha 59) usa o scope `drive.metadata.readonly`. Este scope pode nao retornar arquivos "Compartilhados comigo" que o usuario nao adicionou ao "Meu Drive". O scope correto para listar todos os arquivos acessiveis e `drive.readonly`.

### Problema 2: Backend sem suporte a busca
A edge function `google-list-sheets` nao aceita parametro de busca (`searchTerm`). O usuario nao consegue filtrar planilhas por nome, dificultando encontrar uma planilha recente entre muitas.

### Problema 3: Frontend sem busca, sem paginacao, sem refresh
O modal `SpreadsheetSelectorModal` nao tem:
- Campo de busca
- Botao "Carregar mais" (paginacao com `nextPageToken`)
- Botao "Recarregar" para forcar refresh
- Badge indicando se a planilha e compartilhada
- Auto-refresh ao abrir o modal (usa `useMutation`, que so dispara manualmente uma vez)

## Solucao

### Passo 1 -- Corrigir scope OAuth

Alterar o scope de `drive.metadata.readonly` para `drive.readonly` em `google-sheets-auth/index.ts`. Isso garante acesso a listagem de TODOS os arquivos que o usuario pode ver, incluindo "Compartilhados comigo".

**IMPORTANTE**: Usuarios existentes precisarao reconectar a conta Google para obter o novo scope. O sistema detectara isso automaticamente (o token antigo nao tera o scope necessario) e a listagem pode continuar funcionando com o scope antigo -- a diferenca e que com `drive.readonly` a cobertura e garantida.

**Arquivo**: `supabase/functions/google-sheets-auth/index.ts`

### Passo 2 -- Adicionar busca e campo `shared` no backend

Modificar `google-list-sheets/index.ts` para:
- Aceitar parametro `searchTerm` no body
- Quando presente, adicionar `and name contains '{term}'` ao filtro `q`
- Adicionar `shared` ao campo `fields` para identificar planilhas compartilhadas
- Retornar o campo `shared` no response

**Arquivo**: `supabase/functions/google-list-sheets/index.ts`

### Passo 3 -- Adicionar busca, paginacao e refresh no modal

Modificar `SpreadsheetSelectorModal.tsx` para:
- Campo de busca com debounce de 400ms
- Botao "Recarregar" no topo da lista
- Botao "Carregar mais" no final da lista (usando `nextPageToken`)
- Badge "Compartilhada" quando `shared === true`
- Data de modificacao formatada ao lado do nome

Modificar `useGoogleSheets.ts` para:
- `listSpreadsheets` aceitar `{ pageToken?, searchTerm? }`
- Armazenar e acumular resultados para paginacao
- Retornar `nextPageToken` para o modal

### Passo 4 -- Auto-refresh ao abrir modal

Garantir que sempre que o modal abrir, a lista seja buscada novamente (sem depender de cache antigo). O `useEffect` no modal ja chama `onLoadSpreadsheets` ao abrir, mas o `hasLoadedRef` impede chamadas subsequentes. Ajustar para sempre buscar ao abrir.

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/google-sheets-auth/index.ts` | Alterar scope para `drive.readonly` |
| `supabase/functions/google-list-sheets/index.ts` | Adicionar `searchTerm`, campo `shared`, sanitizacao |
| `src/hooks/useGoogleSheets.ts` | `listSpreadsheets` aceitar searchTerm e pageToken, acumular resultados |
| `src/components/modals/SpreadsheetSelectorModal.tsx` | Busca, paginacao, refresh, badge compartilhada |

## Detalhes tecnicos

### Query Drive API (backend final)
```text
q: mimeType='application/vnd.google-apps.spreadsheet' and trashed=false [and name contains 'termo']
fields: files(id,name,modifiedTime,owners(displayName,emailAddress),shared),nextPageToken
orderBy: modifiedTime desc
pageSize: 50
supportsAllDrives: true
includeItemsFromAllDrives: true
```

### Interface Spreadsheet atualizada
```text
interface Spreadsheet {
  id: string;
  name: string;
  modified_time: string;
  owner?: string;
  shared?: boolean;
}
```

### Nota sobre reautenticacao
Apos alterar o scope, usuarios que ja conectaram a conta Google precisarao reconectar para obter o scope `drive.readonly`. O fluxo existente de "Desconectar Google" + "Conectar ao Google" ja suporta isso. Nenhuma mudanca adicional e necessaria -- basta o usuario reconectar.

