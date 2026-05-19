## Objetivo

Antes de o cliente acessar o formulário de nova demanda, exibir uma tela curta no mesmo design Liquid Glass pedindo **Nome** e **Empresa**. Uma vez preenchida, o cliente vai direto para o fluxo de criação e os dados ficam salvos no perfil (não pede de novo).

## Comportamento

- Ao entrar em `/demands/new`, se o `profile.full_name` ou `profile.company_name` estiverem vazios → mostrar uma tela de identificação (single GlassCard centralizado).
- Dois campos: **Nome completo** e **Empresa**. Botão **Continuar** (desabilitado até ambos terem ≥2 caracteres). Validação com `zod` (`trim`, máx 120).
- Ao confirmar: faz `upsert` em `public.profiles` (`full_name`, `company_name`) e em `public.client_users` (`display_name`, `company_name` se houver coluna; senão só `display_name`) — depois renderiza normalmente o `NewDemandPage`.
- Pré-popular o campo `requester` do formulário de demanda com o nome informado (e usar o nome para o avatar/saudação no header minimalista do cliente).
- Aplica-se a todos os usuários, mas na prática só dispara para `cliente` (admins/managers já têm perfil completo). Sem flags por role — é puro check de "tem nome e empresa?".

## Arquivos

- **Novo** `src/components/demands/new/ClientIdentityGate.tsx`: GlassCard com 2 inputs + botão. Faz o upsert no Supabase e chama `onDone()`.
- **Editar** `src/pages/demands/NewDemandPage.tsx`: no topo, usar `useProfile()`; se `!profile?.full_name || !profile?.company_name` renderizar `<ClientIdentityGate onDone={refetch} />` em vez do wizard. Quando completo, usar `profile.full_name` como `requester` inicial em `EMPTY_FORM`.
- Verificar se `client_users` tem coluna `company_name`; se não tiver, a migration adiciona `company_name text`.

## Detalhes técnicos

- Schema: `z.object({ full_name: z.string().trim().min(2).max(120), company_name: z.string().trim().min(2).max(120) })`.
- Upsert via `supabase.from('profiles').update(...).eq('id', user.id)` (linha já existe via trigger `handle_new_user`).
- Após salvar: `queryClient.invalidateQueries(['profile'])` para refletir o nome no header e desbloquear o wizard.
- Visual: mesmo padrão Liquid Glass dos outros cards — `GlassCard` com header "Vamos começar" + subtítulo "Identifique-se para registrar sua demanda", inputs `bg-white/80`, botão primário gradient.
