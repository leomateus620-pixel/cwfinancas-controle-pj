## Objetivo

1. Criar perfil de acesso "Cliente" com login por **nome de usuário + senha** (sem e-mail).
2. Esse perfil só enxerga **Nova Demanda** no menu.
3. Corrigir alinhamentos do formulário em desktop e mobile.
4. Ao clicar **Próximo**, a tela deve subir ao topo da nova etapa (hoje fica no fim).

---

## 1. Login "Cliente" sem e-mail

O Supabase Auth exige um e-mail no campo `email` — não é possível remover essa exigência. Solução padrão e segura: aceitar **apenas o username** na tela de login e converter internamente para um e-mail sintético `username@cliente.cwfinancas.local`. O usuário nunca vê esse e-mail; ele só digita usuário e senha.

### Banco (migration)
- Novo valor no enum `app_role`: `'cliente'`.
- Nova tabela `client_users` (apenas para o admin gerenciar/visualizar):
  - `id uuid pk`, `user_id uuid` (FK lógica para `auth.users`), `username text unique`, `display_name text`, `created_by uuid`, timestamps.
- RLS: somente `admin`/`manager` podem ler/escrever; o próprio cliente só lê o próprio registro.
- Ajustar trigger `handle_new_user`: quando o `raw_user_meta_data->>'role' = 'cliente'`, inserir role `cliente` em vez de `user` e popular `client_users`.

### Edge Function `create-client-user` (admin-only)
- Recebe `{ username, password, display_name }`.
- Valida que o chamador é admin/manager via `getUser()`.
- Cria o usuário via `supabase.auth.admin.createUser` com:
  - `email: \`${slug(username)}@cliente.cwfinancas.local\``
  - `password`
  - `email_confirm: true`
  - `user_metadata: { role: 'cliente', username, display_name }`
- CORS completo (mesmo padrão das funções Asana).

### Tela de login
- `LoginPage` ganha um toggle "Sou cliente" (ou detecta automaticamente: se o input não contém `@`, trata como username).
- No submit: se for username, monta `email = \`${slug(username)}@cliente.cwfinancas.local\`` antes de chamar `signInWithPassword`.
- Mensagens de erro amigáveis ("Usuário ou senha inválidos").

### Admin: tela de gestão
- Em `/demands/settings`, adicionar bloco **"Acessos de cliente"**:
  - Listagem (username, nome, criado em).
  - Botão **+ Novo acesso** → modal com `username`, `nome`, `senha` (auto-gerada com botão "copiar").
  - Botão para resetar senha e desativar acesso.

---

## 2. Restringir menu a "Nova Demanda" para cliente

- `useUserRole`: expor `isClient` (`hasRole('cliente')`).
- `AppSidebar`:
  - Se `isClient`, renderizar **apenas** o grupo "Demandas" com um único item `Nova Demanda` (anchor = `/demands/new`, sem children, sem KPIs).
- `ProtectedRoute`: se `isClient`, qualquer rota diferente de `/demands/new` (e `/login`) redireciona para `/demands/new`.
- `DashboardHeader`: ocultar para `isClient` filtros globais, notificações administrativas e atalhos de navegação que não sejam logout/avatar.
- Após criar a demanda (`SuccessScreen`), o botão "Ver demanda" some para cliente; mantém só "Criar nova demanda".

---

## 3. Correções de alinhamento (Nova Demanda)

Ajustes em `NewDemandPage.tsx` + `SmartDemandForm.tsx` + `StepIndicator.tsx`:

- **Header**: trocar `flex items-start gap-3` por `flex items-center gap-3` (ícone fica centralizado vertical com o título, hoje sobra acima).
- **Container**: `max-w-6xl` → `max-w-5xl` em mobile e desktop ≤1280, com `px-4 md:px-6`. Grid `1fr_320px` → `1fr_300px` e `gap-5` → `gap-6`; abaixo de `xl` o sidebar passa a ficar **embaixo** (não em `lg`), evitando esmagamento na viewport 966px atual.
- **Cards do tipo**: hoje em `lg:grid-cols-3` quebra ruim em 966px → usar `md:grid-cols-2 xl:grid-cols-3` e aumentar `gap-3` → `gap-4`.
- **SmartDemandForm `Group`**: padding `p-4 md:p-5` → `p-5 md:p-6`; grid interno `md:grid-cols-2` → `sm:grid-cols-2`; gap `4` → `5` para respiro.
- **Inputs**: padronizar altura (`h-10`) e label com `mb-1.5` (hoje labels colam no input).
- **Sidebar resumo (mobile)**: hoje aparece embaixo sem destaque; agrupar valores num card mais compacto e ocultar barra de progresso quando 0%.
- **Stepper**: validar wrap em ≤480px (labels devem ficar abaixo do número, não cortadas).
- **Footer sticky mobile**: aumentar `pb-28` → `pb-32`, garantir `safe-area-inset-bottom` (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`).

---

## 4. Scroll para o topo ao avançar etapa

Causa: a `<main>` em `DashboardLayout` rola, mas o `next()` só atualiza state — a posição de rolagem permanece.

Correção:
- Criar `ref` no container raiz do passo (`stepContainerRef`).
- No `next()` e no `back()`, após `setStep`, chamar:
  ```ts
  requestAnimationFrame(() => {
    stepContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // fallback para mobile com main scroll:
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  ```
- Garantir que o `stepContainerRef` fique acima do Stepper para o usuário ver "Etapa 2" logo após o clique.

---

## Critérios de aceite

- Admin consegue criar um acesso de cliente em `/demands/settings` (usuário + senha, sem e-mail visível).
- Cliente faz login com `usuário` + `senha` e cai direto em `/demands/new`; tenta acessar outra rota → redirecionado.
- Sidebar do cliente mostra apenas **Nova Demanda**; tudo mais está oculto.
- Em viewport 966px e em mobile 390px, o formulário fica alinhado, sem campos esmagados nem footer cobrindo botão de enviar.
- Ao clicar **Próximo**, a tela rola até o topo da nova etapa (visível em desktop e mobile).
- Funcionalidades existentes (criação de demanda, upload, Asana) continuam funcionando para usuários admin/manager/user.
