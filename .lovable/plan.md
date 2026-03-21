

## Plano: Conexão Única para Clientes com Validade de 30 Dias (IMPLEMENTADO)

### Objetivo

Clientes (não-admin) podem conectar sua conta Google e selecionar UMA planilha, uma única vez. A conexão tem validade de 30 dias, após a qual a sincronização é desabilitada.

### Regras implementadas

| Elemento | Admin | Cliente (sem conexão) | Cliente (com conexão ativa) | Cliente (conexão expirada) |
|---|---|---|---|---|
| Botão "Conectar" | Sempre visível | Visível (1x) | Oculto | Oculto (contatar admin) |
| Botão "Desconectar" | Visível | Oculto | Oculto | Oculto |
| Botão "Deletar" | Visível | Oculto | Oculto | Oculto |
| Botão "Sincronizar" | Visível | - | Visível | Desabilitado |
| Info de expiração | Não exibe | - | "Válido até DD/MM/AAAA" | "Expirado em DD/MM/AAAA" |
| Zona de Perigo | Visível | Oculto | Oculto | Oculto |

### E-mails admin

- `leomateus620@gmail.com`
- `contato@cwfinancas.com`
