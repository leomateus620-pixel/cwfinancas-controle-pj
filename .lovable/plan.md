
# Plano de Implementação: Coleta de Dados na Nuvem e Segurança

## Visão Geral

Implementação completa de backend com **Lovable Cloud** incluindo:
- Banco de dados para transações financeiras
- Sistema de autenticação com login/registro
- Sistema de roles para controle de acesso
- Row Level Security (RLS) em todas as tabelas
- Proteção de rotas no frontend
- Integração do upload de Excel com o banco de dados

---

## Fase 1: Configuração do Lovable Cloud

### 1.1 Ativar Lovable Cloud
- Configurar conexão com banco de dados
- Habilitar autenticação
- Configurar storage para arquivos

### 1.2 Estrutura de Tabelas

**Tabela: profiles**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK, referência auth.users |
| full_name | text | Nome completo |
| company_name | text | Nome da empresa |
| avatar_url | text | URL do avatar |
| preferences | jsonb | Preferências do usuário |
| created_at | timestamptz | Data de criação |
| updated_at | timestamptz | Data de atualização |

**Tabela: user_roles**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| role | app_role (enum) | admin, manager, user |

**Tabela: transactions**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| type | text | income / expense |
| description | text | Descrição |
| amount | numeric | Valor |
| category | text | Categoria |
| date | date | Data da transação |
| client_vendor | text | Cliente/Fornecedor |
| notes | text | Observações |
| created_at | timestamptz | Data de criação |

**Tabela: invoices**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| invoice_number | text | Número da NF |
| client_name | text | Nome do cliente |
| value | numeric | Valor |
| issue_date | date | Data de emissão |
| due_date | date | Data de vencimento |
| status | text | paid/pending/overdue |
| created_at | timestamptz | Data de criação |

**Tabela: balance_sheet_items**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| type | text | asset / liability / equity |
| category | text | Categoria |
| name | text | Nome do item |
| amount | numeric | Valor |
| date | date | Data de referência |
| created_at | timestamptz | Data de criação |

**Tabela: uploaded_files**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| file_name | text | Nome do arquivo |
| file_path | text | Caminho no storage |
| rows_imported | integer | Linhas importadas |
| status | text | success/error |
| created_at | timestamptz | Data de criação |

---

## Fase 2: Sistema de Segurança (RLS)

### 2.1 Enum de Roles
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');
```

### 2.2 Função Security Definer para Verificar Role
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```

### 2.3 Políticas RLS

**profiles:**
- SELECT: Usuário pode ver apenas seu próprio perfil
- UPDATE: Usuário pode atualizar apenas seu próprio perfil
- INSERT: Trigger automático ao criar usuário

**user_roles:**
- SELECT: Usuário pode ver suas próprias roles
- INSERT/UPDATE/DELETE: Apenas admins

**transactions:**
- SELECT/INSERT/UPDATE/DELETE: Usuário vê/edita apenas suas transações
- Admins podem ver todas

**invoices:**
- SELECT/INSERT/UPDATE/DELETE: Usuário vê/edita apenas suas notas
- Admins podem ver todas

**balance_sheet_items:**
- SELECT/INSERT/UPDATE/DELETE: Usuário vê/edita apenas seus itens
- Admins podem ver todos

**uploaded_files:**
- SELECT/INSERT/UPDATE/DELETE: Usuário vê/edita apenas seus uploads

---

## Fase 3: Autenticação no Frontend

### 3.1 Novos Arquivos

**src/integrations/supabase/client.ts**
- Configuração do cliente Supabase

**src/contexts/AuthContext.tsx**
- Context para gerenciamento de autenticação
- Estado do usuário logado
- Funções: signIn, signUp, signOut
- Listener para mudanças de sessão

**src/hooks/useAuth.ts**
- Hook para acessar o contexto de autenticação
- Retorna: user, loading, signIn, signUp, signOut

**src/hooks/useUserRole.ts**
- Hook para verificar role do usuário
- Retorna: role, isAdmin, isManager

### 3.2 Páginas de Autenticação

**src/pages/LoginPage.tsx**
- Formulário de login (email + senha)
- Link para registro
- Link para recuperar senha
- Validação com Zod

**src/pages/RegisterPage.tsx**
- Formulário de registro (nome, email, empresa, senha)
- Validação de campos
- Redirecionamento após registro

**src/pages/ForgotPasswordPage.tsx**
- Formulário para recuperar senha

### 3.3 Componente de Proteção de Rotas

**src/components/auth/ProtectedRoute.tsx**
- Verifica se usuário está logado
- Redireciona para login se não autenticado
- Pode verificar roles específicas

---

## Fase 4: Integração de Dados

### 4.1 Hooks de Dados

**src/hooks/useTransactions.ts**
- CRUD de transações
- Filtros por tipo, categoria, período
- React Query para cache e invalidação

**src/hooks/useInvoices.ts**
- CRUD de notas fiscais
- Filtros por status, período

**src/hooks/useBalanceSheet.ts**
- CRUD de itens do balanço
- Agrupamento por tipo (ativo/passivo/PL)

**src/hooks/useUploadedFiles.ts**
- Histórico de uploads
- Status de importação

### 4.2 Upload de Excel Integrado

Atualizar **src/pages/UploadPage.tsx**:
- Após parsing, salvar dados no banco
- Mapear colunas do Excel para campos do banco
- Criar registro em uploaded_files
- Inserir transações em batch
- Exibir status de importação

---

## Fase 5: Atualização das Páginas

### 5.1 Páginas com Dados Reais

**OverviewPage.tsx**
- Buscar totais do banco
- KPIs calculados dos dados reais
- Gráficos com dados do usuário

**IncomePage.tsx**
- Listar transações tipo "income"
- Filtros funcionais
- Botão "Nova Receita" abre modal

**ExpensesPage.tsx**
- Listar transações tipo "expense"
- Filtros funcionais
- Botão "Nova Despesa" abre modal

**CashFlowPage.tsx**
- Calcular fluxo de caixa real
- Projeções baseadas em histórico

**BalanceSheetPage.tsx**
- Buscar itens do balanço
- Calcular totais por categoria

**InvoicesPage.tsx**
- Listar notas fiscais reais
- CRUD de notas

**SettingsPage.tsx**
- Atualizar perfil no banco
- Preferências salvas

### 5.2 Modais de CRUD

**src/components/modals/TransactionModal.tsx**
- Formulário para adicionar/editar transação
- Validação com Zod
- Campos: tipo, descrição, valor, categoria, data, cliente/fornecedor

**src/components/modals/InvoiceModal.tsx**
- Formulário para adicionar/editar nota fiscal
- Campos: número, cliente, valor, datas, status

---

## Fase 6: Storage para Arquivos

### 6.1 Bucket de Uploads

**Bucket: excel-uploads**
- Privado
- RLS: usuário acessa apenas seus arquivos

### 6.2 Fluxo de Upload

1. Usuário seleciona arquivo Excel
2. Parse local com xlsx
3. Preview dos dados
4. Ao confirmar:
   - Upload do arquivo para storage
   - Inserção em batch das transações
   - Registro em uploaded_files
5. Feedback de sucesso/erro

---

## Fase 7: Estrutura de Arquivos Final

```text
src/
  integrations/
    supabase/
      client.ts
      types.ts (tipos gerados)
  
  contexts/
    AuthContext.tsx
  
  hooks/
    useAuth.ts
    useUserRole.ts
    useTransactions.ts
    useInvoices.ts
    useBalanceSheet.ts
    useUploadedFiles.ts
    useProfile.ts
  
  components/
    auth/
      ProtectedRoute.tsx
      AuthGuard.tsx
    modals/
      TransactionModal.tsx
      InvoiceModal.tsx
      BalanceItemModal.tsx
  
  pages/
    LoginPage.tsx (novo)
    RegisterPage.tsx (novo)
    ForgotPasswordPage.tsx (novo)
    (demais páginas atualizadas)
  
  lib/
    validators.ts (schemas Zod)
    formatters.ts (funções de formatação)
```

---

## Fase 8: Validação e Segurança Frontend

### 8.1 Validação de Inputs

**src/lib/validators.ts**
```typescript
// Schemas Zod para todos os formulários
const transactionSchema = z.object({
  description: z.string().min(3).max(200),
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['income', 'expense']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// etc...
```

### 8.2 Sanitização

- Validar todos os inputs antes de enviar ao banco
- Usar encodeURIComponent para URLs
- Nunca usar dangerouslySetInnerHTML com dados do usuário

---

## Ordem de Implementação

| Etapa | Descrição | Arquivos |
|-------|-----------|----------|
| 1 | Ativar Lovable Cloud | Dashboard Lovable |
| 2 | Criar tabelas e RLS | Migrations SQL |
| 3 | Configurar cliente Supabase | integrations/supabase/client.ts |
| 4 | Context de autenticação | contexts/AuthContext.tsx |
| 5 | Páginas de login/registro | pages/LoginPage.tsx, RegisterPage.tsx |
| 6 | Componente ProtectedRoute | components/auth/ProtectedRoute.tsx |
| 7 | Atualizar App.tsx com rotas protegidas | App.tsx |
| 8 | Hook useTransactions | hooks/useTransactions.ts |
| 9 | Atualizar UploadPage | pages/UploadPage.tsx |
| 10 | Atualizar páginas com dados reais | Todas as páginas |
| 11 | Modais de CRUD | components/modals/*.tsx |
| 12 | Configurar storage | Bucket excel-uploads |
| 13 | Testes e validação final | Todos os componentes |

---

## Pré-requisitos

Antes de iniciar a implementação:
1. **Ativar Lovable Cloud** através do painel do projeto
2. Confirmar que o banco de dados está acessível

---

## Resultado Esperado

Sistema completo com:
- Autenticação segura (login, registro, logout)
- Banco de dados com todas as entidades financeiras
- RLS protegendo dados por usuário
- Sistema de roles (admin, manager, user)
- Upload de Excel salvando no banco
- Todas as páginas consumindo dados reais
- Validação de inputs em todos os formulários
- Storage seguro para arquivos
- Interface responsiva e profissional
