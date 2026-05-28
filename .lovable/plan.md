## Plano de correção definitiva: Relatórios e reuniões na nuvem

### Diagnóstico confirmado
- O histórico atual ainda chama `reports-meetings-list` no front, e a rede mostra `Failed to fetch` para essa Edge Function.
- O hook `useMeetingRecorder.ts` ainda usa `reports-meetings-transcribe` como caminho principal para iniciar, autosalvar e finalizar.
- A UI renderiza diagnóstico técnico em `ReportsHistoryTable.tsx` e mensagens como “Sessão backend ausente” / “Finalização será local”.
- O banco e o bucket existem, mas `audio_chunks` e `live_transcript_segments` ainda aparecem como array de texto no schema ativo, enquanto o fluxo desejado pede JSON com metadados dos chunks.

### 1. Ajustar schema e storage de forma idempotente
Vou criar/aplicar uma migration definitiva para:
- Garantir todos os campos necessários em `public.meeting_sessions`.
- Converter `audio_chunks` para `jsonb` com estrutura de metadados do arquivo.
- Converter `live_transcript_segments` para `jsonb`.
- Recriar/normalizar grants para `authenticated` e `service_role`.
- Manter RLS owner-only em `meeting_sessions`.
- Garantir bucket privado `meeting-reports`.
- Recriar policies owner-only do storage usando path `{user_id}/{meeting_id}/...`.
- Adicionar índice por `user_id, started_at`.

### 2. Criar repositório direto de nuvem
Criar `src/features/reports-meetings/lib/meetingCloudRepository.ts` centralizando o core sem Edge Functions:
- `createCloudMeetingSession`
- `autosaveCloudMeetingSession`
- `finalizeCloudMeetingSession`
- `uploadMeetingAudioChunk`
- `listCloudMeetings`
- `getCloudMeetingDetail`
- `deleteCloudMeeting`
- `requestEnhancedSummary` como melhoria opcional, sem bloquear o core

Todas as operações principais usarão:
- `supabase.auth.getUser()`
- `supabase.from('meeting_sessions')`
- `supabase.storage.from('meeting-reports')`

### 3. Refatorar `useMeetingRecorder.ts`
Trocar o fluxo principal para banco/storage direto:
- `start()` cria a sessão diretamente em `meeting_sessions` com `user_id` obrigatório.
- Remover dependência de `reports-meetings-transcribe/start_session`.
- Criar refs sincronizadas para evitar state stale:
  - `meetingSessionIdRef`
  - `persistenceModeRef`
  - `durationMsRef`
  - `manualTranscriptRef`
  - `audioChunksRef`
  - fila de blobs pendentes para retry
- `autosaveMeetingProgress()` atualiza `meeting_sessions` direto.
- `MediaRecorder.ondataavailable` sobe chunks direto no bucket e salva metadados.
- Se upload falhar, guardar blob em memória para retry no próximo chunk e no `finish()`.
- `finish()` finaliza direto no banco com transcrição, duração, chunks, descrição e resumo local determinístico.
- Chamada de IA/resumo via Edge Function será opcional e não exibirá erro ao usuário.

### 4. Limpar UI e remover diagnóstico visual
Em `MeetingRecorderPanel.tsx`:
- Remover mensagens técnicas como `cloudError`, `Sessão backend ausente`, `Finalização será local`.
- Manter apenas status operacional simples e amigável.

Em `ReportsHistoryTable.tsx`:
- Remover import/uso de `cloudDiagnostics`.
- Remover botão “Testar nuvem”.
- Remover JSON técnico.
- Buscar histórico direto do banco.
- Em erro, mostrar só: “Não foi possível carregar o histórico agora.”

Em `ReportsMeetingsPage.tsx`:
- Remover duplicidade de histórico, mantendo uma única experiência limpa.

### 5. Atualizar hooks de biblioteca/histórico
Em `useMeetingsLibrary.ts`:
- Listagem e detalhe passam a usar o repositório direto no banco.
- Exclusão passa a remover arquivos no storage e depois excluir linha do banco diretamente.
- Regeneração de resumo continua Edge Function opcional, com fallback silencioso e invalidação de cache.

### 6. Manter Edge Functions como complementares
Vou revisar e ajustar as funções existentes para continuarem úteis, mas não obrigatórias:
- `reports-meetings-summarize`: refinamento de resumo por IA e purge opcional.
- `reports-meetings-purge-audio`: limpeza de áudio por usuário.
- `reports-meetings-list/detail/delete/transcribe`: mantidas para compatibilidade/admin, mas não chamadas pelo core.

### 7. Validação
Depois da implementação em build mode, validarei:
- Schema real de `meeting_sessions` e policies.
- Upload/listagem do bucket `meeting-reports` via path owner-only.
- Ausência de chamadas obrigatórias para `reports-meetings-list/transcribe` na UI principal.
- Testes automatizados relevantes do projeto.
- Fluxo manual no preview: iniciar reunião, autosave, finalizar, recarregar e ver histórico sem depender de Edge Function.

### Critérios de aceite
- Nenhum painel/botão/JSON de diagnóstico aparece no front.
- Usuário não vê `Failed to send a request to the Edge Function`.
- Reunião é criada no banco ao iniciar.
- Áudio é salvo no Storage em chunks.
- Autosave atualiza transcrição e duração no banco.
- Finalização salva status, resumo local, descrição e chunks no banco.
- Histórico carrega direto do banco.
- Edge Functions podem falhar sem derrubar o fluxo principal.