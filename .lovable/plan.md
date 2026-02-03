
## Objetivo
Corrigir dois problemas do fluxo Google Sheets:
1) Após o login, o modal não lista planilhas disponíveis.
2) Ao clicar “Conectar Planilha” novamente, o usuário é forçado a refazer login (quero sessão persistente).

---

## Diagnóstico (o que está acontecendo hoje)

### 1) Modal não lista planilhas (causa raiz)
A tela `GoogleSheetsPage` usa `useGoogleSheets()` e recebe `tempTokens` após o `exchangeCode`.

Mas o componente `SpreadsheetSelectorModal` também chama `useGoogleSheets()` **de novo**.  
Como `tempTokens` é um `useState` interno do hook, isso cria **dois estados separados**:

- `GoogleSheetsPage` tem `tempTokens = { ... }`
- `SpreadsheetSelectorModal` tem `tempTokens = null`

Resultado: o efeito do modal que chama `listSpreadsheets.mutate()` nunca roda (porque `tempTokens` no modal é `null`), e o modal aparece “vazio”.

Arquivos envolvidos:
- `src/pages/GoogleSheetsPage.tsx`
- `src/components/modals/SpreadsheetSelectorModal.tsx`
- `src/hooks/useGoogleSheets.ts`

### 2) Login não persiste (causa raiz)
Os tokens do Google ficam apenas em memória (`tempTokens`) e são zerados após conectar (`setTempTokens(null)`).
Não existe um “estado de autorização Google” persistido no backend, então sempre que o usuário quiser conectar outra planilha, precisa autorizar novamente.

---

## Solução proposta (alto nível)
Vamos fazer duas melhorias:

### A) Compartilhar o mesmo estado/hook entre página e modal (corrige a lista de planilhas)
- Remover o `useGoogleSheets()` de dentro do `SpreadsheetSelectorModal`
- O hook será chamado **somente na página** (`GoogleSheetsPage`)
- Passaremos por props para o modal: `tempTokens`, `listSpreadsheets`, `getSpreadsheetSheets`, `createConnection`, etc.

Assim, quando `exchangeCode` preencher `tempTokens`, o modal enxergará esses tokens e conseguirá listar planilhas.

### B) Persistir a autorização do Google no backend (corrige “ter que logar toda vez”)
Criar uma tabela simples para guardar os tokens por usuário, e fazer as funções do backend usarem esses tokens.

- Nova tabela: `google_oauth_tokens`
  - `user_id` (uuid, único)
  - `access_token` (texto)
  - `refresh_token` (texto)
  - `expires_at` (timestamp/iso string)
  - `updated_at`
- RLS: apenas o dono consegue ler/escrever o próprio registro.
- Atualizar a função `google-sheets-auth` (POST) para **upsert** nessa tabela quando trocar `code -> tokens`.
- Atualizar a função `google-sheets-list` para:
  - Não depender de receber token no body
  - Pegar tokens do usuário logado via `Authorization Bearer`
  - Se `access_token` expirou (ou Drive retornar 401), usar `refresh_token` para renovar e atualizar a tabela, e então repetir a chamada.
- Ajustar a UI:
  - Antes de redirecionar pro Google, checar se já existe token salvo. Se existir, abrir o modal direto sem novo login.

---

## Mudanças detalhadas (passo a passo)

### 1) Refatorar `SpreadsheetSelectorModal` para NÃO instanciar o hook
**Arquivo:** `src/components/modals/SpreadsheetSelectorModal.tsx`

- Trocar:
  - `const { tempTokens, listSpreadsheets, ... } = useGoogleSheets();`
- Por:
  - Props recebendo os dados/mutações necessários, por exemplo:
    - `tempTokens`
    - `spreadsheets` (ou `listSpreadsheets.data`)
    - `isLoadingSpreadsheets` (`listSpreadsheets.isPending`)
    - `listSpreadsheets` (função para disparar)
    - `getSpreadsheetSheets`
    - `createConnection`

**Resultado esperado:** ao abrir o modal após login, a lista renderiza.

### 2) Ajustar `GoogleSheetsPage` para ser “dona” do hook e passar tudo ao modal
**Arquivo:** `src/pages/GoogleSheetsPage.tsx`

- Manter `useGoogleSheets()` apenas aqui.
- Passar para `<SpreadsheetSelectorModal />` as props necessárias.
- Ajustar os efeitos:
  - Quando tokens estiverem disponíveis, abrir modal e disparar listagem.

### 3) Persistência de sessão Google (tabela + RLS)
**Banco (migração):**
- Criar tabela `google_oauth_tokens`
- Criar políticas RLS:
  - SELECT: `user_id = auth.uid()`
  - INSERT/UPDATE/DELETE: `user_id = auth.uid()`

Observação de segurança: refresh_token é sensível; manter protegido por RLS e não expor desnecessariamente no frontend.

### 4) `google-sheets-auth` salva tokens no backend
**Arquivo:** `supabase/functions/google-sheets-auth/index.ts`

No fluxo POST (exchange de `code`):
- Após obter `access_token`, `refresh_token`, `expires_at`:
  - `upsert` em `google_oauth_tokens` usando `user_id`
- A resposta pode continuar retornando tokens para uso imediato no frontend (opcional), mas o principal é que agora fica salvo para persistência.

### 5) `google-sheets-list` passa a usar tokens persistidos + retry ao expirar
**Arquivo:** `supabase/functions/google-sheets-list/index.ts`

- Identificar usuário via `Authorization` (já faz).
- Buscar tokens em `google_oauth_tokens` para esse `userId`
  - Se não existir: responder com erro claro (`needs_auth: true`) para a UI redirecionar ao login.
- Ao chamar Drive API:
  - Se retornar 401/invalid token: refresh com refresh_token, atualizar tabela e tentar de novo.
- (Opcional) aceitar body sem tokens; manter compatibilidade temporária, mas preferir tokens persistidos.

### 6) UI não redirecionar pro Google se já estiver autorizado
**Arquivo:** `src/hooks/useGoogleSheets.ts` (ou `GoogleSheetsPage.tsx`)

- Criar uma query/mutation “checkAuth” (ex.: chamar uma função do backend pequena ou reutilizar `google-sheets-list` com um `action=status`).
- Regra do botão “Conectar Planilha”:
  - Se “já autorizado”: apenas abrir modal e listar planilhas
  - Se “não autorizado”: abrir OAuth (como hoje)

### 7) Garantir que ao conectar uma planilha não se “perca” a autorização
Hoje `createConnection.onSuccess` faz `setTempTokens(null)`.  
Podemos manter isso para “limpar estado temporário”, mas a autorização persistida continuará salva na tabela, então o usuário não precisará logar novamente.

---

## Plano de testes (para confirmar que está “perfeito”)

### Teste 1 — Primeiro login + listar planilhas
1. Clicar “Conectar Planilha”
2. Fazer login no Google
3. Voltar para `/google-sheets?code=...`
4. Modal abre e:
   - exibe loader enquanto carrega
   - lista planilhas acessíveis
   - ao selecionar uma planilha, lista as abas

**Critério de aceite:** lista aparece sempre; sem modal vazio.

### Teste 2 — Persistência (não pedir login de novo)
1. Fechar modal
2. Clicar “Conectar Planilha” novamente

**Critério de aceite:** não redireciona para login; abre modal e lista planilhas direto.

### Teste 3 — Token expirado
1. Simular token expirado (ou esperar/forçar no backend)
2. Abrir modal e listar planilhas

**Critério de aceite:** backend faz refresh automaticamente e a lista funciona.

### Teste 4 — Conectar planilha e sincronizar
1. Conectar planilha
2. Rodar “Sincronizar”
3. Conferir se transações aparecem nas páginas/dashboards

**Critério de aceite:** KPIs e gráficos refletem os dados importados após o invalidate queries.

---

## Arquivos que provavelmente serão alterados
Frontend:
- `src/pages/GoogleSheetsPage.tsx`
- `src/components/modals/SpreadsheetSelectorModal.tsx`
- `src/hooks/useGoogleSheets.ts`

Backend functions:
- `supabase/functions/google-sheets-auth/index.ts`
- `supabase/functions/google-sheets-list/index.ts`
- (Opcional) `supabase/functions/google-sheets-sync/index.ts` (apenas se decidirmos também puxar tokens persistidos aqui para padronizar)

Banco:
- Migração para criar `google_oauth_tokens` + políticas RLS

---

## Riscos e cuidados
- Precisamos garantir que as políticas RLS da nova tabela não deixem tokens acessíveis a outros usuários.
- Não salvar refresh_token em localStorage; persistência deve ser no backend.
- Garantir que o modal não faça requests “infinitos” caso a autorização não exista (tratar erro e orientar a reconectar).

