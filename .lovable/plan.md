## Diagnóstico

A mensagem **"Failed to send a request to the Edge Function"** aparece quando o `supabase.functions.invoke` falha no `fetch` (rede/CORS), antes de receber uma resposta HTTP utilizável.

Testei a função diretamente com `curl_edge_functions` (autenticado) e ela responde **200 OK** retornando `meeting_session_id`. Ou seja, o código da função está correto, a tabela `meeting_sessions` recebe o insert, e os GRANTs aplicados no último migration estão funcionando.

O problema está na configuração de gateway:

- `supabase/config.toml` lista todas as edge functions do projeto com `verify_jwt = false` (google-*, asana-*, dre-sync, etc.).
- As três funções novas do módulo de reuniões **não estão registradas**: `reports-meetings-transcribe`, `reports-meetings-generate`, `reports-meetings-compare`.
- Sem o bloco no `config.toml`, o gateway aplica `verify_jwt = true` por padrão. Quando o navegador envia o request (mesmo logado), a validação JWT acontece **antes** do código da função rodar, e em caso de rejeição o gateway responde **sem os CORS headers**. O browser então bloqueia a resposta e o cliente `supabase-js` lança exatamente a mensagem `Failed to send a request to the Edge Function` (FunctionsFetchError).
- O `curl` funciona porque não passa por CORS de browser.

A função já valida o JWT internamente via `authClient.auth.getUser(token)`, então desabilitar a verificação de gateway é seguro e segue o mesmo padrão usado nas demais funções do projeto.

## Correção

1. **Adicionar ao `supabase/config.toml`** os três blocos faltantes:
   ```toml
   [functions.reports-meetings-transcribe]
   verify_jwt = false

   [functions.reports-meetings-generate]
   verify_jwt = false

   [functions.reports-meetings-compare]
   verify_jwt = false
   ```

2. **Redeploy** das três funções para aplicar a nova configuração de gateway.

## Validação

- `supabase--curl_edge_functions` em `/reports-meetings-transcribe` com `start_session` → esperar 200 + `meeting_session_id`.
- Conferir nos logs da edge function `booted` recente após o deploy.
- Testar no preview clicando em **Iniciar reunião**: status deve ir para `Gravando` (sem o erro vermelho). Em ambiente sem microfone, o banner âmbar de "modo demonstração" aparece, mas a sessão é criada normalmente.
- `supabase--read_query` em `meeting_sessions ORDER BY created_at DESC LIMIT 3` confirmando a linha inserida com `status = recording`.
- Clicar **Finalizar reunião** e validar que `meeting_audit_logs` recebe `meeting_finished`.

## Escopo

Apenas configuração de gateway das três funções do módulo. Sem mudanças no hook do recorder, no painel, no edge code ou no banco — todos os fixes anteriores permanecem.
