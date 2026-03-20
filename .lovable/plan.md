

## Diagnóstico: Erro `redirect_uri_mismatch` no Google OAuth

### Análise do código

O código já está **correto e dinâmico** — usa `window.location.origin` para construir a `redirect_uri`:

```typescript
// src/hooks/useGoogleSheets.ts linha 131
const redirectUri = `${window.location.origin}/google-sheets`;
```

Isso significa que quando o usuário acessa de `https://cwfinancas-controlepj.com`, a redirect URI enviada ao Google é `https://cwfinancas-controlepj.com/google-sheets`. **Não há nada para alterar no código.**

### Causa do erro

O erro `redirect_uri_mismatch` é 100% configuração do **Google Cloud Console**. Analisando seus screenshots:

**Origens JavaScript autorizadas** — falta o domínio .com:
- ✅ `https://id-preview--718772e9-73b0-4c8f-9c0d-f1285154bf02.lovable.app`
- ❌ **Falta**: `https://cwfinancas-controlepj.com`

**URIs de redirecionamento** — parecem corretos, mas verifique:
- ✅ `https://cwfinancas-controlepj.com/google-sheets`
- ✅ Preview URLs

### O que você precisa fazer no Google Cloud Console

**Origens JavaScript autorizadas** — adicione:
```
https://cwfinancas-controlepj.com
```

**URIs de redirecionamento autorizados** — confirme que tem:
```
https://cwfinancas-controlepj.com/google-sheets
```

Se você também usa `www`, adicione ambas as variantes:
```
https://www.cwfinancas-controlepj.com
https://www.cwfinancas-controlepj.com/google-sheets
```

### Resumo

Nenhuma alteração de código é necessária. O projeto já constrói as URIs dinamicamente. O problema é exclusivamente a falta do domínio `.com` nas **Origens JavaScript autorizadas** do Google Cloud Console.

