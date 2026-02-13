

# Correcao Definitiva: Planilhas Compartilhadas Nao Aparecem

## Causa Raiz Identificada

O problema NAO esta na query do Drive API (que ja esta correta com `supportsAllDrives`, `includeItemsFromAllDrives`, sem filtro de owner). O problema esta no **fluxo OAuth**.

Ao verificar o banco de dados, confirmei:

```text
Usuario ae3ae0d0: scope = "drive.metadata.readonly spreadsheets.readonly"  (ANTIGO - sem drive.readonly)
Usuario dd7f331a: scope = "drive.metadata.readonly drive.readonly spreadsheets.readonly"  (CORRETO)
```

O scope `drive.metadata.readonly` nao retorna "Compartilhados comigo" que o usuario nao adicionou ao "Meu Drive". O scope `drive.readonly` e necessario para listar TODOS os arquivos acessiveis.

### Por que o scope antigo persiste?

No arquivo `google-sheets-auth/index.ts` (linha 72), a logica e:

```text
if (!hasRefreshToken) {
  authUrl.searchParams.set("prompt", "consent");
}
```

Isso significa: se o usuario ja tem um refresh token salvo, ao "reconectar" o Google, o sistema NAO forca a tela de consentimento. O Google reutiliza os scopes antigos e o token novo continua com `drive.metadata.readonly` apenas.

## Solucao (2 correcoes)

### Correcao 1 -- Forcar consent quando scope estiver desatualizado

Alterar `google-sheets-auth/index.ts` para verificar se o scope salvo inclui `drive.readonly`. Se nao incluir, forcar `prompt=consent` mesmo que ja exista refresh token.

Logica:

```text
const requiredScope = "drive.readonly";
const hasRequiredScope = tokenData?.scope?.includes(requiredScope);

// Forcar consent se: nao tem refresh token OU nao tem scope necessario
if (!hasRefreshToken || !hasRequiredScope) {
  authUrl.searchParams.set("prompt", "consent");
}
```

**Arquivo**: `supabase/functions/google-sheets-auth/index.ts`

### Correcao 2 -- Detectar scope insuficiente e pedir reconexao automaticamente

Alterar `google-oauth-status/index.ts` para verificar se o scope salvo inclui `drive.readonly`. Se nao incluir, retornar `needs_reauth: true` com mensagem clara.

No frontend (`GoogleSheetsPage.tsx` ou `useGoogleSheets.ts`), quando `needs_reauth` for detectado, exibir um banner/toast pedindo ao usuario para reconectar, e disparar automaticamente o fluxo de reconexao.

**Arquivos**: `supabase/functions/google-oauth-status/index.ts`, `src/pages/GoogleSheetsPage.tsx`

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/google-sheets-auth/index.ts` | Verificar scope salvo; forcar `prompt=consent` se `drive.readonly` ausente |
| `supabase/functions/google-oauth-status/index.ts` | Retornar `needs_reauth` quando scope insuficiente |
| `src/pages/GoogleSheetsPage.tsx` | Exibir alerta e botao de reconexao quando `needs_reauth` for true |

## Fluxo apos a correcao

```text
1. Usuario abre pagina Google Sheets
2. Backend verifica scope salvo no token
3. Se scope NAO inclui "drive.readonly":
   a. Frontend exibe: "Reconecte sua conta Google para acessar todas as planilhas compartilhadas"
   b. Botao "Reconectar Google" inicia fluxo OAuth com prompt=consent
   c. Google pede consentimento para o novo scope
   d. Token atualizado com drive.readonly
4. Listagem agora retorna TODAS as planilhas (Meu Drive + Compartilhadas)
```

## O que NAO muda

- A query do Drive API (`google-list-sheets`) ja esta correta e nao precisa de alteracao
- O modal de selecao ja tem busca, paginacao e refresh
- O armazenamento de tokens ja funciona corretamente

## Nota importante

Apos implementar, o usuario atual precisara clicar em "Reconectar Google" UMA VEZ para obter o scope atualizado. Apos isso, todas as planilhas compartilhadas aparecerao automaticamente.

