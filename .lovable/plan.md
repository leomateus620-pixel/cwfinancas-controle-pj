

## Plano: Corrigir Erro de Login Após Troca de Domínio

### Problema identificado

Dois problemas distintos:

1. **Refresh token inválido** — Ao trocar de domínio, tokens de sessão antigos ficam no localStorage. Quando o Supabase tenta auto-refresh, falha com "Refresh Token Not Found", gerando erro visível ao usuário via GlobalErrorHandler.

2. **Credenciais inválidas** — O erro "Invalid login credentials" no auth log indica que a senha ou e-mail estão incorretos, OU que o e-mail não foi confirmado (email confirmation está habilitado e o usuário não verificou). Isso não é um bug de código, mas podemos melhorar o tratamento.

### Solução

**Arquivo: `src/contexts/AuthContext.tsx`**
- No `useEffect` de inicialização, capturar erros de `getSession()` e do `onAuthStateChange`
- Quando detectar `refresh_token_not_found` ou `invalid_refresh_token`, chamar `supabase.auth.signOut()` silenciosamente para limpar o localStorage corrompido
- Isso evita o loop de erros e permite login limpo

**Arquivo: `src/components/error/GlobalErrorHandler.tsx`**
- Filtrar erros de auth (refresh token) para não exibir toast redundante ao usuário — esses já são tratados pelo AuthContext

**Arquivo: `src/pages/LoginPage.tsx`**
- Melhorar mensagem de erro para incluir caso de e-mail não confirmado ("Email not confirmed" → mensagem clara em português)
- Adicionar tratamento para "Email not confirmed" separado de "Invalid login credentials"

### Detalhes técnicos

```typescript
// AuthContext.tsx - getSession com error handling
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    // Stale token from old domain - clear silently
    supabase.auth.signOut();
    setSession(null);
    setUser(null);
  } else {
    setSession(session);
    setUser(session?.user ?? null);
  }
  setLoading(false);
});

// onAuthStateChange - handle TOKEN_REFRESHED failure
if (event === 'TOKEN_REFRESHED' && !session) {
  supabase.auth.signOut();
}
```

```typescript
// GlobalErrorHandler.tsx - ignore auth refresh errors
const isAuthRefreshError = errorMessage.includes("Refresh Token") 
  || errorMessage.includes("refresh_token");
if (isAuthRefreshError) {
  event.preventDefault();
  return; // handled by AuthContext
}
```

```typescript
// LoginPage.tsx - better error messages
if (error.message === "Email not confirmed") {
  description = "Verifique seu e-mail para confirmar sua conta antes de entrar.";
}
```

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/contexts/AuthContext.tsx` | Tratar erro de refresh token, limpar sessão corrompida |
| `src/components/error/GlobalErrorHandler.tsx` | Filtrar erros de auth refresh do toast |
| `src/pages/LoginPage.tsx` | Melhorar mensagens de erro (email não confirmado) |

