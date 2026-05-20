# Auto-atualização de versão (Cache Busting Inteligente)

Objetivo: garantir que após cada publicação, todos os usuários (PC e mobile) recebam a versão mais recente automaticamente, sem limpar cache manualmente e sem deslogar.

## Estratégia (sem Service Worker)

O projeto NÃO usa PWA/Service Worker (confirmado em `vite.config.ts` e `main.tsx`). Vamos usar abordagem leve:
- Vite já gera assets com hash (`assets/*-[hash].js`) — ok nativo.
- Vamos garantir que `index.html` nunca fique em cache antigo.
- Um `version.json` público + hook que compara e recarrega quando necessário.
- Idle/visibility-aware: verifica ao abrir, ao voltar pra aba, e após 10min de inatividade.
- Proteção contra loop de reload.

## Arquivos a criar

```text
public/version.json                          # versão pública (consultada com no-store)
scripts/generate-version.mjs                 # gera version.json no build (timestamp + commit)
src/lib/version.ts                           # APP_VERSION + helpers (fetchRemoteVersion, clearAppCaches)
src/hooks/useAppVersionCheck.ts              # lógica de polling + idle + visibility
src/components/system/AppUpdateHandler.tsx   # monta o hook + toast discreto "Atualizando..."
```

## Arquivos a editar

- `index.html` → adicionar meta `Cache-Control: no-cache, no-store, must-revalidate` (via meta http-equiv) e `<meta name="app-version" content="__APP_VERSION__">`.
- `vite.config.ts` → `define: { __APP_VERSION__: JSON.stringify(...) }` lendo de `version.json` gerado no build; manter assets com hash (default já faz).
- `package.json` → adicionar `"prebuild": "node scripts/generate-version.mjs"` para regenerar `public/version.json` a cada build/publish.
- `src/App.tsx` → montar `<AppUpdateHandler />` dentro do `BrowserRouter` (acima das rotas), nada mais.

## Como funciona o fluxo

1. Build gera `public/version.json` com `{ version, buildId, deployedAt }` (timestamp do build).
2. Vite injeta `APP_VERSION` (mesmo valor) no bundle via `define`.
3. Ao montar `AppUpdateHandler`:
   - Faz `fetch('/version.json', { cache: 'no-store' })`.
   - Compara `data.version` com `APP_VERSION` do bundle.
   - Se diferente → toast discreto "Nova versão disponível. Atualizando o sistema..." → `clearAppCaches()` (apenas `caches.*` e chaves `cwf-version-*`; preserva tokens `sb-*`/auth) → `location.reload()`.
4. Eventos que disparam nova verificação:
   - `visibilitychange` (volta pra aba).
   - Idle timeout de **10 min** (listeners: `mousemove`, `keydown`, `click`, `scroll`, `touchstart`) — após idle, na próxima interação ou `visibilitychange` reverifica.
   - Polling leve a cada **5 min** em background (só quando aba visível).
5. Anti-loop: grava `sessionStorage['cwf-last-reload-at']`. Se já recarregou nos últimos 30s, não recarrega de novo; mostra mensagem amigável.

## Preservação (não mexer)

- Login/sessão: não tocamos em chaves `sb-*` nem `supabase.auth.*` ao limpar cache.
- Rotas, permissões, dados, integrações Asana/Sheets/Cloud: nenhum impacto.
- Layout: zero alteração visual, exceto um toast Sonner discreto (já existe `<Sonner />` no App).
- DRE, Forecasts, demandas, fluxo Asana: intocados.

## Detalhes técnicos

**`scripts/generate-version.mjs`**
```js
import { writeFileSync } from 'node:fs';
const now = new Date();
const pad = (n) => String(n).padStart(2,'0');
const version = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
const payload = { version, buildId: `build_${Date.now()}`, deployedAt: now.toISOString() };
writeFileSync('public/version.json', JSON.stringify(payload, null, 2));
process.env.APP_VERSION_OUT && writeFileSync(process.env.APP_VERSION_OUT, version);
console.log('[version]', payload);
```

**`vite.config.ts`** — ler `public/version.json` (ou gerar inline) e injetar:
```ts
define: {
  __APP_VERSION__: JSON.stringify(readVersion()),
  __BUILD_ID__: JSON.stringify(readBuildId()),
}
```

**`src/lib/version.ts`**
```ts
export const APP_VERSION: string = (globalThis as any).__APP_VERSION__ ?? 'dev';
export async function fetchRemoteVersion() {
  const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('version fetch failed');
  return r.json() as Promise<{ version: string; buildId: string; deployedAt: string }>;
}
export async function clearAppCaches() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  // limpa só chaves do nosso versionamento — preserva auth (sb-*) e dados
  Object.keys(localStorage).filter(k => k.startsWith('cwf-version-')).forEach(k => localStorage.removeItem(k));
}
```

**`useAppVersionCheck.ts`** — encapsula: fetch inicial, listeners de visibility/idle, polling 5min, anti-loop com `sessionStorage`. Quando detecta nova versão: `toast.message('Nova versão disponível', { description: 'Atualizando o sistema...' })` → `await clearAppCaches()` → `location.reload()`.

**`index.html`** — adicionar dentro do `<head>`:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

## Validação

- Build local: confirmar `dist/version.json` gerado e `APP_VERSION` injetada no bundle.
- Simular versão antiga: editar manualmente `public/version.json` em runtime (dev) → confirmar toast + reload.
- Voltar para aba após 10min ocioso → confirmar reverificação.
- Confirmar que sessão Supabase persiste após reload (não desloga).
- Confirmar ausência de loop (anti-reload 30s).
- Mobile: testar Chrome Android / Safari iOS via `visibilitychange`.

## Fora de escopo

- Não vamos adicionar Service Worker / PWA (instruções explícitas e risco de cache pior em preview).
- Não vamos mexer em headers do servidor (hospedagem Lovable já trata HTML como no-cache); meta tags reforçam.
