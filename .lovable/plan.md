

## Plano: Páginas Públicas de Política de Privacidade e Termos de Uso

### Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `src/pages/PrivacyPolicyPage.tsx` | Página pública com texto completo da Política de Privacidade |
| `src/pages/TermsOfUsePage.tsx` | Página pública com texto completo dos Termos de Uso |

### Arquivos a modificar

| Arquivo | Descrição |
|---|---|
| `src/App.tsx` | Adicionar 2 rotas públicas: `/politica-de-privacidade` e `/termos-de-uso` |
| `src/pages/SettingsPage.tsx` | Adicionar card "Documentos Legais" com URLs e botões de copiar |
| `src/pages/LoginPage.tsx` | Adicionar links no rodapé da tela de login |
| `src/pages/RegisterPage.tsx` | Adicionar links no rodapé da tela de registro |
| `src/components/layout/DashboardLayout.tsx` | Adicionar rodapé com links para as páginas legais |

### Detalhes

**1. Páginas legais (PrivacyPolicyPage + TermsOfUsePage)**
- Layout standalone (sem sidebar/header do dashboard), similar às páginas de login
- Logo CW Finanças no topo
- Botão "Voltar ao início" com link para `/`
- Conteúdo completo conforme textos fornecidos
- Data de última atualização: `19 de março de 2026`
- E-mail placeholder: `privacidade@cwfinancas.com.br`
- SEO: `document.title` via useEffect + meta description
- Responsivo: `max-w-3xl mx-auto`, padding adequado mobile/desktop
- Tipografia: headings com hierarquia clara, parágrafos com `leading-relaxed`

**2. Rotas em App.tsx**
- Adicionar junto às rotas públicas existentes (login, register, forgot-password)

**3. Card "Documentos Legais" em SettingsPage**
- Ícone `FileText`, posicionado antes do card de Segurança
- 3 itens: URL inicial, Política de Privacidade, Termos de Uso
- Cada item com URL visível + botão "Copiar" que usa `navigator.clipboard`

**4. Links no rodapé**
- `DashboardLayout`: footer discreto abaixo do `<Outlet />` com links para ambas as páginas
- `LoginPage` e `RegisterPage`: links no rodapé do formulário

