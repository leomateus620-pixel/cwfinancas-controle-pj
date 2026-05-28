## Diagnóstico encontrado

A falha visível no painel vem do fluxo de nuvem das reuniões. O backend está online, a função `reports-meetings-list` responde quando chamada diretamente e já existem reuniões sendo criadas no banco. Porém há inconsistências que impedem o fluxo completo de salvar/listar/resumir funcionar de forma confiável no app:

- A tabela `meeting_sessions` está sem permissões explícitas de acesso via API para `authenticated` e `service_role`. Mesmo usando funções de backend, isso deixa fallback direto do frontend e alguns caminhos de leitura/gravação vulneráveis a falhas de permissão.
- A função `reports-meetings-transcribe` em produção não responde corretamente ao health check usado pelos diagnósticos, indicando que o código implantado pode estar desalinhado com o arquivo local ou com a rota de validação.
- As reuniões estão sendo finalizadas sem `description`, `summary_markdown`, `summary_generated_at` e `audio_purged_at`, então o histórico aparece sem dados úteis e sem confirmação de descarte do áudio.
- O frontend engole erros em `start`, `autosave` e `finish` em alguns pontos, gerando avisos genéricos como “Failed to send a request to the Edge Function” sem recuperar ou expor a causa real.
- O fluxo de resumo atual não aciona descarte de áudio ao final, apesar da regra do produto ser manter apenas descrição e resumo consultáveis.

## Plano de correção

1. **Corrigir permissões e consistência do banco**
   - Aplicar uma migração segura em `meeting_sessions` para garantir permissões explícitas a usuários autenticados e serviço interno.
   - Garantir índices necessários para histórico por usuário/data.
   - Manter RLS owner-only: cada usuário só acessa as próprias reuniões.

2. **Fortalecer as funções de backend**
   - Padronizar CORS, respostas JSON e validação JWT nas funções `reports-meetings-*`.
   - Corrigir `reports-meetings-transcribe` para responder corretamente a `health`, `start_session`, `autosave_session` e `finalize_session`.
   - Corrigir `reports-meetings-summarize` para sempre persistir `description`, `summary_markdown`, `summary_generated_at`, `summary_status` e chamar o descarte de áudio após concluir.
   - Corrigir `reports-meetings-list/detail/delete/purge-audio` para usar o mesmo padrão de autenticação, erro e escopo por usuário.

3. **Corrigir o frontend do gravador**
   - Remover fallbacks silenciosos que mascaram falhas internas.
   - Mostrar estado real da nuvem: iniciando, salvando, salvo, finalizando, erro recuperável.
   - Ao finalizar, invalidar/recarregar o histórico para a reunião aparecer imediatamente.
   - Transformar erros técnicos em mensagens úteis, preservando detalhes para debug.

4. **Corrigir o histórico na nuvem**
   - Garantir que a listagem use a função correta com sessão autenticada.
   - Exibir estados de processamento de resumo, sem resumo, resumo pronto e áudio descartado.
   - Manter descrição e resumo como os únicos dados consultáveis pelo usuário após processamento.

5. **Validação completa da feature**
   - Testar chamadas diretas das funções: health, start, autosave, finalize, summarize, list, detail e purge/delete quando aplicável.
   - Confirmar no banco que a reunião criada recebe `status=finished`, `description`, `summary_markdown`, `summary_generated_at` e `audio_purged_at`.
   - Confirmar que a listagem retorna a reunião finalizada para o usuário autenticado.
   - Verificar no frontend que o painel sai de erro e o histórico carrega sem “Failed to send a request to the Edge Function”.

## Resultado esperado

Ao final, o fluxo ficará:

```text
Iniciar reunião
  -> cria sessão na nuvem
  -> grava/transcreve/autosalva
Finalizar reunião
  -> salva transcrição final
  -> gera descrição e resumo
  -> descarta áudio temporário
  -> histórico lista reunião salva
  -> detalhe exibe resumo consultável
```

Vou implementar apenas esse fluxo de reuniões na nuvem, sem mexer em outros menus ou módulos.