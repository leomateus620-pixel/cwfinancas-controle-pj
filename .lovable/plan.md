## Diagnóstico

O usuário `leomateus620@gmail.com` **existe e está confirmado** no banco (último login em 19/05). Porém, no console do navegador encontrei a sequência exata da falha:

1. Ao abrir a página, o cliente Supabase encontra um **refresh token inválido/corrompido** no localStorage e dispara `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.
2. Nosso `AuthContext` reage a isso chamando `supabase.auth.signOut()` — mas esse `signOut` faz uma requisição de rede que falha com `TypeError: Failed to fetch` (porque o cliente Supabase entrou em estado inconsistente após o erro de refresh).
3. Quando o usuário clica **Entrar**, o `signInWithPassword` também falha com `TypeError: Failed to fetch` antes mesmo de sair do navegador — por isso **não aparece nenhum POST `/token`** nos logs de auth do Supabase nos últimos 30 minutos para esse e-mail. O botão fica eternamente girando porque a Promise rejeita, o `toast` aparece mas o estado de sessão local continua quebrado.

Resumo: não é credencial errada, é o cliente Supabase preso em sessão fantasma.

## Correção

### 1. `src/contexts/AuthContext.tsx` — sanear sessão fantasma antes de qualquer chamada

- No início do `useEffect`, **antes** de `getSession()`, detectar refresh token inválido e limpar o storage do Supabase manualmente (chaves `sb-<ref>-auth-token*` no `localStorage` e `sessionStorage`), em vez de depender de `signOut()` que falha quando o estado já está corrompido.
- Envolver o handler `TOKEN_REFRESHED && !session` em `try/catch` e, em vez de `signOut()`, fazer limpeza local + `setSession(null)`. Isso evita o `Failed to fetch` em cascata.
- Tratar `getSession()` que rejeita (em vez de só `error`) com o mesmo caminho de limpeza local.

### 2. `src/pages/LoginPage.tsx` — mensagem clara para erro de rede

- No `catch` do submit, distinguir `TypeError: Failed to fetch` (ou `error.message` contendo "fetch") e mostrar toast: *"Não foi possível conectar ao servidor. Verifique sua conexão ou desative extensões do navegador que bloqueiem requisições e tente novamente."*
- Garantir que o `finally` sempre desliga o `isLoading` (já está correto, manter).

### 3. Orientação ao usuário (sem código)

O stack trace mostra também uma `chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/libs/requests.js` interceptando o `fetch`. Após o deploy, se o erro persistir, pedirei para o usuário testar em aba anônima (sem extensões) — mas a limpeza acima já resolve o caso "refresh token corrompido", que é o gatilho real.

## Arquivos afetados

- `src/contexts/AuthContext.tsx` — limpeza defensiva de tokens locais
- `src/pages/LoginPage.tsx` — mensagem de erro mais útil para falha de rede

Sem mudanças de banco, sem novas migrations, sem mexer no `client.ts`.