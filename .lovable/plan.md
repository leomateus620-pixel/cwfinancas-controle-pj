# Suporte à Nuvem no menu de Reuniões

## Objetivo
Tornar o menu de Reuniões 100% nuvem: corrigir o bug "Sessão backend ausente", armazenar o áudio durante a gravação, gerar **descrição curta + resumo estruturado** via IA ao finalizar, e manter um **histórico consultável** com apenas descrição e resumo (áudio descartado após o processamento, conforme solicitado).

---

## 1. Causa do erro atual (validado)
O painel mostra "Sessão backend ausente" porque a tabela `meeting_sessions` está sem colunas que o autosave/finalize usam (`duration_seconds`, `audio_chunks`, `last_autosave_at`, `metadata`, `live_transcript_segments`). O `start_session` em si funciona, mas o autosave subsequente quebra e o hook degrada para modo local. Também não existe nenhum fluxo de **resumo persistido** nem **listagem de gravações**.

---

## 2. Mudanças no backend (Lovable Cloud)

### 2.1. Migração `meeting_sessions`
Adicionar colunas que faltam + colunas do novo fluxo:
- `duration_seconds INT DEFAULT 0`
- `audio_chunks TEXT[] DEFAULT '{}'`
- `last_autosave_at TIMESTAMPTZ`
- `metadata JSONB DEFAULT '{}'`
- `live_transcript_segments TEXT[] DEFAULT '{}'`
- `description TEXT` — frase única, ~200 chars, gerada por IA
- `summary_markdown TEXT` — resumo estruturado (tópicos, decisões, ações, números)
- `summary_generated_at TIMESTAMPTZ`
- `audio_purged_at TIMESTAMPTZ` — marca quando o áudio bruto foi removido
- `language TEXT DEFAULT 'pt-BR'`

Índice: `(user_id, started_at DESC)` para o histórico.

GRANTs já existem; políticas RLS owner-only permanecem.

### 2.2. Bucket `meeting-reports` (já existe, privado)
Políticas de storage (owner-only por prefixo `{user_id}/...`):
- SELECT/INSERT/UPDATE/DELETE somente quando `(storage.foldername(name))[1] = auth.uid()::text`.

Os chunks de áudio continuam temporários: usados apenas para gerar transcrição/resumo e depois apagados.

### 2.3. Edge Functions

**`reports-meetings-transcribe`** (existente — ajustes)
- Manter `start_session` / `autosave_session` / `finalize_session`.
- No `finalize_session`, após persistir transcrição, **invocar internamente** `reports-meetings-summarize` (fire-and-forget com `await` curto + timeout) para gerar descrição + resumo.
- Retornar `meeting_session_id`, `status`, `description`, `summary_markdown` quando disponíveis.

**`reports-meetings-summarize`** (novo)
- Input: `{ meeting_session_id }`.
- Lê `transcript_text`. Chama Lovable AI Gateway (`google/gemini-2.5-flash`) com prompt estruturado pt-BR pedindo:
  1. `description`: 1 frase objetiva (≤ 240 chars)
  2. `summary_markdown`: tópicos discutidos, decisões, ações (responsável + prazo quando citados), números/valores mencionados, próximos passos
- Persiste `description`, `summary_markdown`, `summary_generated_at`.
- Após sucesso, chama `purge_audio` (abaixo).
- Auth: `verify_jwt = false` + validação manual com `authClient.auth.getUser(token)` + CORS completo (padrão do projeto).

**`reports-meetings-purge-audio`** (novo, interno)
- Lista objetos em `meeting-reports/{user_id}/{session_id}/audio/` e remove via `storage.from('meeting-reports').remove(...)`.
- Marca `audio_purged_at = now()`, limpa `audio_chunks` e `audio_storage_path`.
- Idempotente — pode ser chamado também pelo botão "Apagar áudio agora".

**`reports-meetings-list`** (novo, leitura)
- Retorna histórico paginado do usuário: `id, title, started_at, ended_at, duration_seconds, description, status, summary_generated_at, audio_purged_at`. (Sem `transcript_text` nem `summary_markdown` para reduzir payload.)

**`reports-meetings-detail`** (novo, leitura)
- Retorna a reunião completa (inclui `summary_markdown`) sob demanda quando o usuário abre o card no histórico.

**`reports-meetings-delete`** (novo)
- Apaga áudio remanescente + remove a linha de `meeting_sessions` (owner-only).

Registrar todas as novas funções em `supabase/config.toml` com `verify_jwt = false` (padrão Lovable atual) — o JWT é validado dentro do código.

---

## 3. Mudanças no frontend

### 3.1. Hook `useMeetingRecorder`
- Corrigir o motivo do "Sessão backend ausente": as novas colunas removem o erro silencioso do autosave; manter o fallback local apenas para casos sem rede.
- Após `finish()`, fazer polling curto (até 12s) por `description`/`summary_markdown` e exibir no painel.
- Botão extra "Gerar resumo novamente" chama `reports-meetings-summarize`.

### 3.2. `MeetingRecorderPanel`
- Substituir o aviso atual de fallback local pelo estado real do backend (badge "Salvo na Nuvem ✓" quando há `meeting_session_id`).
- Após finalização: card com **Descrição** (1 linha) + **Resumo** (markdown) + chip "Áudio descartado após processamento" quando `audio_purged_at` está preenchido.

### 3.3. Nova seção `MeetingsHistoryPanel` (em `ReportsMeetingsPage`)
- Lista (via `reports-meetings-list`) ordenada por data desc com:
  - Título + data + duração formatada
  - Descrição (1 linha) com `line-clamp-2`
  - Botão "Ver resumo completo" → modal/expand carregando `reports-meetings-detail`
  - Ação "Excluir" (confirmação) → `reports-meetings-delete`
- Estados Loading / Error / Empty obrigatórios (regra Core do projeto).
- Mobile-friendly, segue Liquid Glass Premium (GlassCard, tabular-nums em duração).

### 3.4. Tipos & queries
- `useMeetingsLibrary` (React Query, key `["meetings-library"]`) com `staleTime: 60_000`.
- Invalidar após `finish()` e após exclusão.

---

## 4. Política de retenção (importante)
Por pedido explícito do usuário, **apenas descrição e resumo ficam persistidos**. O áudio é:
1. Gravado em chunks no bucket privado durante a sessão (necessário para resiliência).
2. Usado para gerar/melhorar a transcrição.
3. **Removido automaticamente** logo após `summarize` concluir com sucesso.
4. Transcrição bruta (`transcript_text`) permanece em banco para permitir regenerar resumo; pode ser ocultada da UI (somente descrição + summary_markdown aparecem ao usuário).

---

## 5. Validação
1. `supabase--curl_edge_functions` em `start_session` → 200 + `meeting_session_id`.
2. `autosave_session` → 200 (colunas novas).
3. `finalize_session` em sessão com transcrição mock → retorna `description` + `summary_markdown`; `audio_purged_at` setado; bucket `meeting-reports/{uid}/{sid}/audio/` vazio.
4. `reports-meetings-list` retorna a sessão recém-criada.
5. UI: gravar 30s no preview → status "Salvo na Nuvem ✓" → finalizar → ver descrição + resumo → recarregar página → reunião aparece no histórico.
6. Excluir reunião → some da lista e bucket limpo.

---

## 6. Fora de escopo
- Reprocessamento por IA mais avançado (Whisper server-side) — fica para iteração futura; o pipeline já está preparado para troca de modelo.
- Compartilhamento entre usuários — mantém owner-only.

Aprove para eu implementar nessa ordem: migração → edge functions → hook/painel → histórico → validação.
