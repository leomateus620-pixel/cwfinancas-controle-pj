
Objetivo (definitivo e verificável)
- Eliminar 100% dos casos de “tela branca” na app (global e especificamente em /google-sheets).
- Garantir que /google-sheets sempre renderize um dos 3 estados: loading, erro (com “Tentar novamente”), ou sucesso (lista).
- Corrigir a listagem de planilhas usando Google Drive API (incluindo Shared Drives quando aplicável) e paginação.
- Persistir login Google (sem pedir login toda hora) e nunca retornar tokens sensíveis ao frontend.
- Permitir selecionar 1 planilha, salvar conexão, e fazer preview de dados (abas + primeiras linhas) para confirmar que dá para ler e gerar dashboards.
- Criar trilha de diagnóstico: logs claros no console do browser + logs no backend (persistidos em tabela) + respostas JSON padronizadas.

Diagnóstico (causa raiz mais provável do bug atual)
1) “Tela branca” intermitente em /google-sheets
   - Hoje não existe Error Boundary global nem específico da rota. Qualquer erro de renderização (ou erro em efeito que leve a estado inválido) pode derrubar a árvore React e virar tela branca.
   - Além disso, há operações assíncronas em handlers/effects e mutações React Query que podem falhar; mesmo com toasts, um erro de render em algum ponto não fica capturado.

2) Login ok, mas lista de planilhas vazia
   - A função atual google-sheets-list chama Drive API, mas:
     - Query está incompleta vs. “padrão robusto” (sem trashed=false, sem orderBy, sem nextPageToken, sem pageSize, sem supportsAllDrives/includeItemsFromAllDrives).
     - Se as planilhas do usuário estiverem majoritariamente em Shared Drives ou “Compartilhados comigo”, a listagem pode retornar vazia se não passarmos os parâmetros corretos (isso é muito comum em contas de empresa).
     - A função mistura duas responsabilidades (listar planilhas e listar abas) e devolve formatos diferentes; isso aumenta risco de UI quebrar em edge cases.
   - Também há um ponto crítico de segurança/requisito: google-sheets-auth ainda retorna access_token/refresh_token para o frontend e o hook mantém tempTokens. Mesmo que “funcione”, isso viola seu requisito e aumenta chance de estado inconsistente/bugs.

Estratégia de correção (em ordem obrigatória, como você pediu)

A) ELIMINAR TELA BRANCA (Frontend)
A1) Error Boundary global (cobre erros de render)
- Criar um componente ErrorBoundary (class component) com:
  - UI amigável (“Ocorreu um erro inesperado”) + botão “Recarregar” e “Voltar para o Dashboard”.
  - console.error com stack + contexto (rota atual).
  - Toast destrutivo (“Erro inesperado, tente novamente”).
- Envolver toda a árvore do app (no topo de App.tsx ou main.tsx) com esse boundary.

A2) Error Boundary específico da rota /google-sheets
- Implementar um RouteBoundary para /google-sheets que:
  - Mostra uma UI mais específica (ex.: “Falha na integração com Google Sheets”) + botão “Tentar novamente” (re-executa o carregamento / invalida queries) + botão “Reconectar Google”.
- No App.tsx, trocar o element da rota para algo como:
  - <GoogleSheetsRouteBoundary><GoogleSheetsPage/></GoogleSheetsRouteBoundary>

A3) /google-sheets com 3 estados (loading / error / success) sempre
- Dentro de GoogleSheetsPage, criar uma máquina simples de estados para a página:
  - loading: checando auth / processando callback OAuth / carregando conexões
  - error: um erro “não fatal” com retry (sem quebrar a página)
  - success: exibe UI (mesmo que vazia)
- Regras:
  - Se auth ainda checando: mostrar skeleton/loader.
  - Se NOT_CONNECTED e sem “code” na URL: mostrar UI guiada (“Conectar Google”).
  - Se existe “code”: mostrar estado “Conectando…” até finalizar exchange.
  - Se der erro em qualquer etapa: mostrar card de erro com “Tentar novamente” e “Reconectar”.

A4) Capturar erros assíncronos para nunca derrubar a UI
- Em App.tsx (ou main.tsx), adicionar:
  - window.addEventListener("unhandledrejection", ...) com console.error e toast, e impedir o comportamento padrão quando apropriado.
  - window.addEventListener("error", ...) para runtime errors globais (log + toast).
- Em handlers do GoogleSheetsPage:
  - Envolver chamadas async em try/catch e atualizar estado de erro da página (além de toast).

A5) Fallbacks (anti “map undefined”, estados vazios)
- Garantir que todo “.map” receba array: (spreadsheets ?? []).
- Garantir que sheetsData?.sheets também use fallback vazio.
- Guard clauses em todos os locais que dependem de session/user.

B) CORRIGIR LISTAGEM DE PLANILHAS (Drive API + parâmetros robustos)
B1) Separar responsabilidade: criar função dedicada google_list_sheets (Drive)
- Criar uma nova função backend: google_list_sheets (nome novo para evitar confusão com a atual).
- Implementar chamada Drive API com:
  - Endpoint: GET https://www.googleapis.com/drive/v3/files
  - q: mimeType='application/vnd.google-apps.spreadsheet' and trashed=false
  - fields: files(id,name,modifiedTime,owners(displayName,emailAddress)),nextPageToken
  - orderBy=modifiedTime desc
  - pageSize=100 (ou 200, dentro do razoável)
  - includeItemsFromAllDrives=true
  - supportsAllDrives=true
  - corpora=user (default) e opcional: includeItemsFromAllDrives já ajuda bastante
  - (Opcional, mas recomendado) também permitir filtro “sharedWithMe” se você quiser listar planilhas compartilhadas sem estar no “Meu Drive”. Normalmente includeItemsFromAllDrives cobre grande parte, mas “sharedWithMe” pode ajudar.
- Suportar paginação: aceitar pageToken no body e retornar nextPageToken.

B2) Escopos OAuth mínimos e corretos (confirmar e endurecer)
- Garantir que a URL de autorização inclua ambos:
  - https://www.googleapis.com/auth/drive.metadata.readonly (ou drive.readonly se necessário)
  - https://www.googleapis.com/auth/spreadsheets.readonly
- Incluir include_granted_scopes=true para evitar regressões quando o Google reutiliza grants.
- Evitar prompt=consent sempre:
  - Só usar prompt=consent quando não existir refresh_token persistido (ou quando refresh falhar com invalid_grant).
  - Manter access_type=offline sempre.

B3) Refresh token “de verdade” e sem sobrescrever com null
- Ajustar google-sheets-auth:
  - No token exchange, refresh_token pode vir vazio em logins subsequentes.
  - Regra obrigatória: se refresh_token não veio, manter o que já existe no banco (não sobrescrever).
  - Salvar também scope e token_type retornados pelo Google.
- Remover completamente o retorno de tokens no response (frontend não deve receber token).

B4) Auto-refresh e retry transparente
- Em google_list_sheets:
  - detectar 401/invalid_token
  - refresh no token endpoint
  - persistir novo access_token + expires_at (+ refresh_token se rotacionar)
  - repetir a chamada automaticamente
- Retornar erros com JSON padronizado:
  - 401: { code:'NOT_CONNECTED', message:'Conecte sua conta Google' }
  - 401 refresh falhou: { code:'REAUTH_REQUIRED', message:'Reautorize sua conta Google' }
  - 500: { code:'GOOGLE_API_ERROR', message:'Falha ao listar planilhas', details?:... }

C) EDGE FUNCTIONS — implementar 2 funções novas e robustas
C1) /functions/v1/google_list_sheets
- Implementar exatamente como acima.
- Autenticação:
  - verify_jwt continuará false no config.toml, mas a função vai validar Authorization Bearer e usar supabase.auth.getUser(token) (como hoje).
- Tokens:
  - Buscar na tabela google_oauth_tokens pelo user_id.
- Logging:
  - console.error/console.log com requestId (gerado na função).
  - Persistir eventos em uma nova tabela de logs (ver seção D3).

C2) /functions/v1/google_read_sheet_preview
- Input: { spreadsheetId: string }
- Fluxo:
  - Validar auth user.
  - Buscar tokens persistidos (mesma estratégia).
  - Chamar Sheets API:
    1) GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?fields=sheets.properties,properties.title
       - Retorna abas (sheet titles)
    2) GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
       - Range padrão: primeira aba + “A1:Z20” (primeiras 20 linhas)
       - Se falhar, tentar fallback “A1:Z20” sem aba explícita.
  - Retornar JSON para UI:
    { spreadsheet:{id,name}, sheets:[{title,index,sheetId}], preview:{range, values}, warnings?:[] }
- Mesma política de refresh e retry do list.

C3) Manter compatibilidade temporária
- Manter google-sheets-list e google-sheets-sync por enquanto, mas o frontend passará a usar google_list_sheets e google_read_sheet_preview.
- Depois podemos remover/limpar a função antiga sem quebrar nada.

D) BANCO (schema/RLS) — endurecer e completar
D1) Alterar google_oauth_tokens para o schema exigido
- Hoje: id, user_id(unique), access_token, refresh_token, expires_at, created_at, updated_at
- Ajustes necessários:
  - provider text default 'google'
  - scope text
  - token_type text
  - (Opcional) trocar PK para user_id (ou manter id e unique user_id; ambos funcionam. Seu requisito aceita PK ou unique.)
- Garantir triggers/updated_at continuam OK.

D2) RLS (confirmar)
- Já existe SELECT/INSERT/UPDATE/DELETE por user_id = auth.uid()
- Validar que não há nenhuma policy permissiva adicional.

D3) Criar tabela de logs no backend (para cumprir “logado no backend”)
- Criar tabela public.google_integration_logs:
  - id uuid pk
  - user_id uuid null (pode ser null se falhar auth)
  - route text (ex.: 'google_list_sheets', 'google_read_sheet_preview', 'google-sheets-auth')
  - level text ('info'|'warn'|'error')
  - message text
  - details jsonb (stack, response snippet, status_code, request_id)
  - created_at timestamptz default now()
- RLS:
  - Usuário só vê seus logs (SELECT auth.uid()=user_id)
  - Inserts feitos via service role nas funções (não precisa policy aberta para insert via client).
- Cada função fará insert em caso de erro (e opcionalmente em success com baixo volume).

E) FRONTEND — fluxo completo e confiável (sem tokens no client)
E1) Botão “Conectar planilha”
- Regra:
  - Se backend diz NOT_CONNECTED: iniciar OAuth (getAuthUrl)
  - Se CONNECTED: abrir modal imediatamente e chamar google_list_sheets
- Importante:
  - “status” deve vir do backend, não de SELECT direto na tabela google_oauth_tokens via client. (Mesmo com RLS, isso é menos robusto e foge da regra “não retornar tokens pro frontend”.)
  - Criar uma chamada simples de status:
    - Opção 1: uma função backend google_oauth_status
    - Opção 2: reaproveitar google_list_sheets com um action=status (mas eu recomendo função dedicada status para não “pagar” Drive API só para checar).
  - Implementação escolhida no código: criar google_oauth_status (pequena e barata).

E2) Modal: listar com busca local
- Ao abrir modal:
  - disparar google_list_sheets
  - loading skeleton enquanto carrega
  - erro -> UI no modal com “Tentar novamente”
  - vazio -> empty state “Nenhuma planilha encontrada — verifique permissões/conta”
- Adicionar input “Buscar planilha” filtrando localmente por name.

E3) Selecionar planilha -> salvar conexão -> preview
- Criar tabela user_connected_sheets (ou reaproveitar google_sheet_connections, mas do jeito atual ela mistura tokens por conexão; vamos corrigir para não depender disso):
  - user_id, spreadsheet_id, spreadsheet_name, created_at
- Ao selecionar uma planilha:
  1) salvar conexão (insert)
  2) chamar google_read_sheet_preview
  3) exibir confirmação: nome + abas + preview (20 linhas)
  4) botão “Confirmar conexão”
- Depois, ao confirmar:
  - criar/atualizar google_sheet_connections (ou substituir por uma estrutura limpa que referencia user_connected_sheets). Nesta etapa definimos a estratégia final para integração com sync.

E4) Sync e dashboards
- Ajustar google-sheets-sync para NÃO depender de tokens guardados em google_sheet_connections:
  - Deve sempre buscar tokens de google_oauth_tokens por user_id.
  - Isso reduz risco, centraliza refresh e evita inconsistências.
- Após sync:
  - invalidar queries existentes (transactions, invoices, balance-sheet etc.), como já fazem.
- Garantir que há um caminho claro na UI para “Sincronizar agora” e ver logs do sync.

F) DIAGNÓSTICO — entregas adicionais obrigatórias
F1) Checklist de verificação (5–10 itens)
1. Ao entrar em /google-sheets sem estar conectado ao Google: aparece UI “Conectar Google” (não tela branca).
2. Após conectar: modal abre e lista planilhas; se falhar, aparece erro com “Tentar novamente”.
3. DevTools Console: sem erros não tratados; se houver erro, aparece log com stack e requestId.
4. Network: chamadas para google_oauth_status, google_list_sheets, google_read_sheet_preview retornam JSON padronizado (nunca HTML).
5. Edge logs: existem registros na tabela google_integration_logs quando ocorrer falha (com requestId).
6. Escopos: consent inclui drive.metadata.readonly e spreadsheets.readonly.
7. refresh_token persistiu e não foi sobrescrito com null em logins seguintes.
8. Token expira -> listagem continua funcionando (refresh automático) sem pedir login.
9. Selecionar planilha -> preview mostra abas e 20 linhas.
10. Sync importa transações e dashboards refletem após refresh (React Query invalidation).

F2) Passo-a-passo de teste manual (reprodutível)
1. No Google Account: revogar acesso do app (Google Account -> Security -> Third-party access).
2. No browser: limpar site data (cookies/storage) do domínio do app.
3. Login no app.
4. Abrir /google-sheets:
   - Deve aparecer estado guiado (NOT_CONNECTED).
5. Clicar “Conectar planilha”:
   - OAuth abre, permitir scopes, concluir.
6. Retornar para /google-sheets:
   - Deve mostrar “Conectado” e abrir modal (ou botão para abrir).
7. Modal:
   - lista planilhas; usar busca; escolher 1.
8. Preview:
   - ver abas + primeiras linhas.
9. Confirmar conexão.
10. Rodar Sync:
   - ver dados nas páginas/ dashboards.
11. Reabrir /google-sheets:
   - não deve pedir OAuth novamente.
12. (Teste refresh) Forçar expiração diminuindo expires_at no banco (ambiente test) e repetir listagem:
   - deve auto-refresh e continuar.

Plano de execução (sequência prática de implementação)
1) Exploração e reprodução guiada
   - Reproduzir no Preview: /google-sheets, clicar conectar, observar network/console.
   - Ler logs atuais das funções e requests para identificar se Drive API está retornando 0 ou está falhando.
2) Implementar Error Boundaries + handlers globais (unhandledrejection/error)
   - Global boundary + route boundary
   - GoogleSheetsPage com estados (loading/error/success) e UI guiada NOT_CONNECTED
3) Criar novas funções backend:
   - google_oauth_status
   - google_list_sheets (Drive API robusta + paginação + shared drives)
   - google_read_sheet_preview (Sheets API + preview)
   - Todas com refresh/retry + logs persistidos em google_integration_logs
4) Migração banco:
   - Alter google_oauth_tokens (provider/scope/token_type)
   - Criar google_integration_logs
   - Criar user_connected_sheets (ou ajustar google_sheet_connections para referenciar sem tokens)
5) Atualizar google-sheets-auth:
   - Não retornar tokens
   - Não sobrescrever refresh_token
   - Salvar scope/token_type
   - Lógica prompt=consent condicional (baseada em status)
6) Frontend:
   - useGoogleSheets: parar de usar tempTokens; usar google_oauth_status
   - Modal passa a consumir google_list_sheets e google_read_sheet_preview
   - UI com busca local, empty state e retry
7) Sync:
   - Atualizar google-sheets-sync para usar tokens do google_oauth_tokens (não por conexão)
8) Testes end-to-end (com checklist) + ajustes finais

Notas de segurança (não negociáveis, alinhadas ao seu requisito)
- Frontend nunca recebe access_token/refresh_token.
- Tokens ficam somente no banco, protegidos por RLS; funções usam service role internamente.
- Qualquer falha retorna JSON amigável e aparece na UI com retry, além de:
  - console.error com stack
  - registro no backend em google_integration_logs com requestId e detalhes.

O que vou precisar confirmar (rápido, para calibrar a listagem)
- Se suas planilhas estão principalmente em “Meu Drive” ou em “Shared Drives/Compartilhados comigo”. Vou implementar suporte a ambos, mas isso ajuda a validar o cenário real ao testar.
