

## Plano: Restrição de Acesso à Gestão de Planilhas por Perfil

### Objetivo

Clientes comuns só podem **ver e sincronizar** a planilha já conectada. Apenas os admins (`leomateus620@gmail.com` e `contato@cwfinancas.com`) podem conectar, desconectar e gerenciar planilhas livremente.

### Abordagem

Criar um hook/constante que identifica se o usuário logado é admin (baseado no e-mail), e usar isso na `GoogleSheetsPage` para esconder/desabilitar botões restritos.

### Arquivo: `src/pages/GoogleSheetsPage.tsx`

Alterações na UI baseadas no e-mail do usuário:

| Elemento | Admin | Cliente |
|---|---|---|
| Botão "Conectar Planilha" | ✅ Visível | ❌ Oculto |
| Botão "Desconectar Google" | ✅ Visível | ❌ Oculto |
| Botão 🗑️ (deletar conexão) | ✅ Visível | ❌ Oculto |
| Botão "Sincronizar" | ✅ Visível | ✅ Visível |
| "Zona de Perigo" (reset) | ✅ Visível | ❌ Oculto |
| Estado "not_connected" | Mostra botão conectar | Mostra mensagem "Entre em contato com o administrador" |
| Estado "Nenhuma Planilha" (vazio) | Mostra botão conectar | Mostra mensagem informativa |

### Implementação

1. Importar `useAuth` no `GoogleSheetsPageContent`
2. Definir lista de e-mails admin: `["leomateus620@gmail.com", "contato@cwfinancas.com"]`
3. Derivar `const isSheetAdmin = ADMIN_EMAILS.includes(user?.email ?? "")`
4. Condicionar renderização dos botões/seções com `{isSheetAdmin && ...}`
5. No estado `not_connected` para não-admins: mostrar card informativo sem botão de conexão
6. No estado de lista vazia para não-admins: mostrar mensagem "Sua planilha ainda não foi configurada. Entre em contato com o administrador."

### Segurança

Esta é uma restrição de **UI apenas**, o que é suficiente para o caso de uso descrito (clientes não sabem que podem manipular a API diretamente). Para segurança completa no backend, seria necessário RLS adicional, mas para o cenário atual (impedir clientes de verem/acessarem planilhas de outros) o RLS existente por `user_id` já cobre isso.

