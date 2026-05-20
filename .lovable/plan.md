
# Asana — incluir Solicitante/Empresa e anexar arquivos da demanda

## Diagnóstico

1. **Solicitante e Empresa ausentes na descrição do Asana.** O campo `financial_demands.requester_metadata` (jsonb `{name, company}`) já é salvo no banco quando a demanda é criada, mas o `asana-create-task` e o `asana-update-task` não leem esse campo nem renderizam essas linhas nas `notes`. Por isso a descrição mostra só: Código, Tipo, Cliente/Fornecedor, Valor, Vencimento, Prioridade, Status (igual ao print enviado).

2. **Anexos nunca são enviados ao Asana.** Os arquivos vão para o bucket privado `demand-documents` (tabela `financial_demand_documents`), mas não há nenhuma chamada para o endpoint `POST /tasks/{gid}/attachments` da Asana. O fluxo cria a task e termina — anexos ficam só dentro do nosso app.

## Correções

Ambas as correções ficam **dentro das duas edge functions** já existentes, sem alterar UI, hooks, RLS, schema, ou o fluxo de criação da demanda. Tudo continua idempotente; em caso de falha de upload de um anexo, registra erro no `asana_sync_logs` e segue (não derruba a sincronização da task).

### 1. Incluir Solicitante e Empresa nas notes

**`supabase/functions/asana-create-task/index.ts`** e **`supabase/functions/asana-update-task/index.ts`**:

- Adicionar `requester_metadata` ao `interface Demand`:
  ```ts
  requester_metadata: { name?: string; company?: string } | null;
  ```
- Em `buildNotes` (e no bloco equivalente do update), inserir duas linhas logo após `Cliente/Fornecedor`:
  ```text
  Solicitante: {requester_metadata.name ?? "—"}
  Empresa: {requester_metadata.company ?? "—"}
  ```

A ordem final fica: Código → Tipo → Cliente/Fornecedor → **Solicitante** → **Empresa** → Valor → Vencimento → Prioridade → Status → Descrição → Link interno.

### 2. Anexar arquivos da demanda à task do Asana

**Somente em `asana-create-task`** (após criar a task com sucesso) e replicar a mesma rotina em **`asana-update-task`** (para reanexar arquivos que foram adicionados depois).

Fluxo para cada documento de `financial_demand_documents`:

1. Buscar todos os docs do `demand_id` via service role.
2. Para cada doc:
   - Download via `svc.storage.from("demand-documents").download(file_path)` → `Blob`.
   - Criar `FormData`:
     ```ts
     const form = new FormData();
     form.append("file", blob, file_name);
     ```
   - POST para `https://app.asana.com/api/1.0/tasks/{task_gid}/attachments` com `Authorization: Bearer ${ASANA_PAT}` (sem Content-Type — fetch define o boundary).
3. Logar resultado por anexo em `asana_sync_logs` com `action: "attachment"`, status `success`/`error`.

**Anti-duplicação no update**: antes de tentar reanexar, listar anexos existentes via `GET /tasks/{gid}/attachments?opt_fields=name` e pular os que já existem com o mesmo `file_name`. Isso evita anexos duplicados a cada update.

**Tolerância a falhas**:
- Erro em um anexo individual NÃO marca a task como `error` nem aborta os próximos anexos.
- Cada falha vira uma linha em `asana_sync_logs` com `action: "attachment"`, `error_message` e o `file_name` no `request_payload`.

**Limites**:
- Asana aceita até 100MB por anexo via PAT. Se `file_size > 100 * 1024 * 1024`, pular o anexo e logar como `error` com motivo "arquivo excede 100MB".

## Arquivos alterados

- `supabase/functions/asana-create-task/index.ts` — `Demand` ganha `requester_metadata`; `buildNotes` ganha linhas Solicitante/Empresa; nova função `uploadAttachments(svc, taskGid, demandId)` chamada após sucesso do create.
- `supabase/functions/asana-update-task/index.ts` — `Demand` ganha `requester_metadata`; mesmo bloco de notes ajustado; reusa `uploadAttachments` com checagem de duplicatas via lista do Asana.

Nenhum arquivo de frontend, hook, migration ou política RLS é alterado.

## Critério de aceite

1. Demanda nova criada hoje: ao abrir a task no Asana, a descrição mostra `Solicitante:` e `Empresa:` preenchidos com `requester_metadata.name` / `.company`.
2. Demanda com 1+ anexos: cada arquivo aparece na aba de anexos da task no Asana (testar PDF e imagem).
3. Update subsequente não duplica anexos já presentes.
4. Falha de upload de um anexo: outros anexos continuam, task permanece `synced`, e há entrada de erro em `asana_sync_logs` com `action='attachment'`.
5. Demandas antigas que já tinham task no Asana: ao acionar resync (botão atual), descrição é atualizada com Solicitante/Empresa e anexos pendentes são enviados.
