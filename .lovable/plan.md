

## Plano: Corrigir Problemas do Google Console + Links Quebrados

### Problemas identificados (do screenshot do Google Console)

1. **Página inicial protegida por login** — `/` redireciona para `/login`, Google não consegue acessar
2. **Página inicial sem link para Política de Privacidade**
3. **Página inicial não explica a finalidade do app**
4. **Links quebrados** — nas páginas de Política/Termos, "Voltar ao início" leva a `/` que redireciona para login

### Solução

Criar uma **landing page pública** na rota `/` e mover o dashboard autenticado para `/dashboard`.

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/LandingPage.tsx` | **Criar** — página pública com descrição do app, CTA login/registro, links legais |
| `src/App.tsx` | Tornar `/` público (LandingPage), adicionar `/dashboard` para HomePage protegida |
| `src/components/layout/AppSidebar.tsx` | Atualizar link "Home" de `/` para `/dashboard` |
| `src/components/auth/ProtectedRoute.tsx` | Redirect default de `/` para `/login` (sem mudança necessária) |
| `src/pages/PrivacyPolicyPage.tsx` | "Voltar ao início" aponta para `/` (já funciona com landing pública) |
| `src/pages/TermsOfUsePage.tsx` | Idem |
| `src/pages/HomePage.tsx` | Sem alteração de conteúdo |
| `src/components/home/HomeEmptyState.tsx` | Sem alteração |

### Detalhes

**1. LandingPage.tsx** — Página pública, sem autenticação:
- Logo CW Finanças
- Título + descrição clara da finalidade do app (gestão financeira para PJ)
- Botões CTA: "Entrar" → `/login`, "Criar conta" → `/register`
- Links visíveis para Política de Privacidade e Termos de Uso no rodapé
- Visual consistente com o projeto (liquid-glass, mesma paleta)
- SEO: document.title + meta description

**2. App.tsx** — Reestruturar rotas:
- `/` → `<LandingPage />` (pública)
- `/dashboard` → `<HomePage />` (protegida, dentro do DashboardLayout)
- Demais rotas protegidas sem alteração

**3. AppSidebar.tsx** — Atualizar:
- `{ title: "Home", url: "/", icon: Home }` → `{ title: "Home", url: "/dashboard", icon: Home }`

**4. Referências internas** — Verificar e atualizar qualquer `navigate("/")` ou `<Link to="/">` dentro de componentes protegidos para apontar para `/dashboard`:
- `HomeEmptyState.tsx` — sem referência a `/`
- `ProtectedRoute.tsx` — `<Navigate to="/" replace />` para role denied → manter (vai para landing, ok)
- `LoginPage.tsx` — `from` default é `/` → mudar para `/dashboard`

Isso resolve todos os 4 problemas do Google Console: página pública acessível, com descrição do app, com links para política de privacidade, e sem bloqueio de login.

