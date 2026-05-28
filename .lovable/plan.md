## Diagnóstico

O card "Modo reunião" fica em **status: blocked** com a mensagem genérica *"Sem permissão de microfone ou sessão indisponível"*. Investigando o código (`src/features/reports-meetings/hooks/useMeetingRecorder.ts` e `supabase/functions/reports-meetings-transcribe/index.ts`), identifiquei três causas que se combinam:

1. **Iframe do preview sem permissão de microfone.** O `navigator.mediaDevices.getUserMedia({ audio: true })` falha silenciosamente dentro do preview do Lovable porque a Permissions-Policy do iframe não concede `microphone`. Sem fallback, o catch dispara, marca `blocked` e nunca chama a edge function (os logs de `reports-meetings-transcribe` estão vazios — confirma que a função nunca foi invocada).
2. **Erro genérico e estado permanente.** Qualquer falha (mic, rede, edge, RLS) cai no mesmo `catch` com a mesma mensagem, e o status fica preso em `blocked` — os botões Pausar/Finalizar permanecem desabilitados e não há como tentar de novo sem recarregar.
3. **Tabelas sem GRANT no schema public.** A migration `20260528120000_reports_meetings_module.sql` cria `meeting_sessions`, `meeting_audit_logs`, etc., habilita RLS e cria policies, mas **não emite `GRANT`** para `authenticated`/`service_role`. Mesmo se o microfone funcionar, o insert da sessão retorna *permission denied for table* via PostgREST.

## Correções

### 1. `src/features/reports-meetings/hooks/useMeetingRecorder.ts`
- Separar as duas tentativas em blocos try/catch independentes:
  - Tentar microfone; se falhar (`NotAllowedError`, `NotFoundError`, `SecurityError` típico de iframe sem `allow="microphone"`), seguir em **modo demo sem áudio** (sem `MediaRecorder`) e exibir aviso amigável: *"Microfone indisponível no preview. Abra o app em nova aba para gravar áudio real. Iniciando reunião em modo demonstração."*
  - Chamar a edge function `start_session`; se falhar, mostrar mensagem específica do erro retornado e **voltar ao status `idle`** (não `blocked`) para permitir nova tentativa.
- Mapear códigos de erro do `getUserMedia` para mensagens claras (permissão negada vs. dispositivo ausente vs. bloqueado por política).
- Garantir `tracks.stop()` no `finish`/`unmount` para liberar o mic.
- Adicionar `permissionState` ('granted' | 'denied' | 'unavailable' | 'unknown') para a UI conseguir mostrar contexto.

### 2. `src/features/reports-meetings/components/MeetingRecorderPanel.tsx`
- Exibir banner de aviso quando o modo demo estiver ativo (mic indisponível) com link "Abrir em nova aba" apontando para a URL pública.
- Manter o botão "Iniciar reunião" reativável depois de erro (não ficar travado).
- Trocar a cor da mensagem de erro para usar o token semântico `text-destructive` em vez de `text-red-600`.

### 3. Nova migration: GRANTs faltantes
Criar migration adicionando os `GRANT`s exigidos pelo PostgREST nas tabelas do módulo:
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sources        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_meeting_reports    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_sessions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_comparisons    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_audit_logs     TO authenticated;
GRANT ALL ON public.meeting_sources, public.pre_meeting_reports, public.meeting_sessions,
             public.meeting_comparisons, public.meeting_audit_logs TO service_role;
```
(Sem grant para `anon` — tudo é por usuário.)

### 4. `supabase/functions/reports-meetings-transcribe/index.ts`
- Trocar `supabase.auth.getUser()` (sem token explícito) por `authClient.auth.getUser(token)` extraído do header `Authorization`, padrão do projeto, evitando 401 silencioso quando o cookie de sessão não está presente.
- Retornar erros estruturados (`{ error, code }`) para o frontend exibir mensagem correta.

## Validação
1. Aplicar migration (GRANTs) e checar `supabase--read_query` em `information_schema.role_table_grants`.
2. Recarregar `/relatorios-reunioes`, clicar "Iniciar reunião":
   - **Cenário A — preview sem mic:** aparece aviso de modo demo, status vai para `recording`, as linhas mockadas começam a aparecer no transcript, "Finalizar" funciona e retorna `topic_summary`.
   - **Cenário B — nova aba com permissão concedida:** mic captura, sessão criada, finalização salva no banco.
3. Conferir registros em `meeting_sessions` e `meeting_audit_logs` via `supabase--read_query`.
4. Conferir logs de `reports-meetings-transcribe` para garantir 200 nas duas chamadas.

## Arquivos alterados
- `src/features/reports-meetings/hooks/useMeetingRecorder.ts` (refactor de erros + modo demo)
- `src/features/reports-meetings/components/MeetingRecorderPanel.tsx` (banner + tokens)
- `supabase/functions/reports-meetings-transcribe/index.ts` (auth via token)
- `supabase/migrations/<novo>_meeting_module_grants.sql` (GRANTs)
