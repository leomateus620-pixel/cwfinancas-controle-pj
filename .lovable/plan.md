## Situação

- O usuário `cwfinancas` ainda **não existe** no banco (`auth.users` não tem nenhum cliente com esse login). Por isso o login com `bpo2026` falha com "Usuário ou senha incorretos".
- A trava de menu já está pronta no código: existe o papel `cliente`, e `ProtectedRoute` + `AppSidebar` já restringem quem tem esse papel a ver/usar **apenas Nova Demanda** (`/demands/new`).
- O que falta é criar a conta com o papel correto.

## Ação

1. **Criar o usuário cliente via admin** (service role, ignora HIBP — por isso `bpo2026` passa):
   - login: `cwfinancas`
   - senha: `bpo2026`
   - e-mail sintético interno: `cwfinancas@cliente.cwfinancas.local`
   - `email_confirm: true`
   - `full_name: "CW Finanças"`

2. **Atribuir o papel `cliente`** em `public.user_roles` (não `user`). Isso é o que ativa a restrição "só Nova Demanda".

3. **Inserir linha em `public.client_users`** (username `cwfinancas`, `is_active: true`) — usada pela tela de gestão de clientes para listar/reativar/resetar senha.

4. **Validar**:
   - Login `cwfinancas` / `bpo2026` na tela `/login` entra direto.
   - Sidebar mostra **apenas "Nova Demanda"**; qualquer tentativa de acessar `/dashboard`, `/dre`, etc., redireciona para `/demands/new`.
   - Logout funciona normalmente.

## Sem alterações de código

Não vou mexer em sidebar, ProtectedRoute, `/register` ou políticas. Toda a lógica de "cliente só vê Nova Demanda" já está implementada — só precisamos que a conta exista com o papel certo.
