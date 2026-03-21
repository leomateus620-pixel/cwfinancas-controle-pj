

## Plano: Conexão Única para Clientes com Validade de 30 Dias

### Objetivo

Permitir que clientes (não-admin) conectem sua conta Google e selecionem UMA planilha, uma única vez. A conexão terá validade de 30 dias, após a qual o cliente precisará reconectar.

### Mudanças

**Arquivo: `src/pages/GoogleSheetsPage.tsx`**

1. **Estado `not_connected` para não-admins**: trocar a mensagem informativa pelo botão "Conectar ao Google", mas somente se o usuário ainda não tiver nenhuma conexão ativa
2. **Após conexão criada**: esconder botão de conectar (já tem 1 conexão = não pode criar outra)
3. **Mostrar validade**: exibir a data de expiração (30 dias após `created_at`) no card da conexão
4. **Conexão expirada**: se passaram 30 dias, mostrar banner informando que a conexão expirou e permitir reconectar (substituindo a antiga)

**Arquivo: `src/hooks/useGoogleSheets.ts`**

5. Na `createConnection`: para não-admins, verificar se já existe uma conexão antes de permitir criar outra (proteção extra no frontend)

### Lógica de controle

```typescript
const hasExistingConnection = (connections ?? []).length > 0;
const canConnect = isSheetAdmin || !hasExistingConnection;

// Expiração: 30 dias após created_at
const isExpired = (connection) => {
  const created = new Date(connection.created_at);
  const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > expiry;
};
```

### UI por perfil atualizada

| Elemento | Admin | Cliente (sem conexão) | Cliente (com conexão ativa) | Cliente (conexão expirada) |
|---|---|---|---|---|
| Botão "Conectar" | Sempre visível | Visível (1x) | Oculto | Visível (reconectar) |
| Botão "Desconectar" | Visível | Oculto | Oculto | Oculto |
| Botão "Deletar" | Visível | Oculto | Oculto | Oculto |
| Botão "Sincronizar" | Visível | - | Visível | Desabilitado |
| Info de expiração | Não exibe | - | "Válido até DD/MM/AAAA" | "Expirado em DD/MM/AAAA" |
| Zona de Perigo | Visível | Oculto | Oculto | Oculto |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/GoogleSheetsPage.tsx` | Permitir conexão única para não-admins, exibir validade de 30 dias, banner de expiração |

