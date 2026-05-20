## Objetivo
Incluir o **CNPJ/CPF** da demanda nas tarefas do Asana e **separar visualmente** quem **enviou** a demanda (Solicitante) de quem é a **contraparte** (Cliente/Fornecedor/Tomador/Sacado etc.), evitando que os dados se misturem.

## Diagnóstico
- O formulário já salva `supplier_document` (CNPJ/CPF da contraparte) e `requester_metadata` completo (name, company, email, phone, role) na tabela `financial_demands`.
- As Edge Functions `asana-create-task` e `asana-update-task` montam o campo `notes` da task Asana, mas **não incluem `supplier_document`** e juntam tudo numa lista linear, sem separar Solicitante × Contraparte.

## Mudanças (somente backend / Edge Functions, sem alterar UI nem dados)

### 1. `supabase/functions/asana-create-task/index.ts`
- Adicionar `supplier_document` na interface `Demand`.
- Reescrever `buildNotes()` em **3 blocos visuais** separados por divisores `────`:
  1. **📋 DEMANDA** — Código, Tipo, Valor, Vencimento, Prioridade, Status.
  2. **👤 QUEM ENVIOU (Solicitante)** — Nome, Empresa, Cargo/Setor, E-mail, WhatsApp.
  3. **🏢 CONTRAPARTE (Cliente/Fornecedor/Tomador/Sacado)** — Nome (`supplier_name`) e **CNPJ/CPF (`supplier_document`)** — rótulo dinâmico conforme `demand_type` (Fornecedor para pagamento, Cliente para recebimento/boleto, Tomador para nota fiscal etc.).
  4. **📝 DESCRIÇÃO**
  5. **🔗 Link interno**
- Manter o `titlePrefix` atual (`[supplier_name]`) que já ajuda na identificação.

### 2. `supabase/functions/asana-update-task/index.ts`
- Aplicar a mesma estrutura de `notes` (extrair função `buildNotes()` igual à de create) e adicionar `supplier_document` no SELECT/interface.
- Garante que tarefas já criadas sejam reformatadas no próximo update/retry.

### 3. Helper de rótulo
Função `contrapartLabel(demand_type)`:
- `pagamento` → "Fornecedor"
- `recebimento` / `boleto` → "Cliente / Sacado"
- `nota_fiscal` → "Tomador"
- `reembolso` → "Beneficiário"
- demais → "Cliente / Fornecedor"

## Exemplo do `notes` final no Asana
```text
📋 DEMANDA
Código: DEM-00123
Tipo: pagamento
Valor: R$ 1.500,00
Vencimento: 25/05/2026
Prioridade: Alta
Status: em_analise
────────────────────────────
👤 QUEM ENVIOU (Solicitante)
Nome: Maria Silva
Empresa: Acme Ltda
Cargo/Setor: Diretora Financeira
E-mail: maria@acme.com
WhatsApp: (11) 98765-4321
────────────────────────────
🏢 FORNECEDOR (quem será pago)
Nome: Fornecedor XYZ Ltda
CNPJ/CPF: 12.345.678/0001-90
────────────────────────────
📝 DESCRIÇÃO
Pagamento de serviços de consultoria referente a abril/2026.
────────────────────────────
🔗 Link interno: https://app.../demands/<id>
```

## Validação
- Criar uma demanda de teste de cada tipo (pagamento, nota fiscal, boleto) com CNPJ/CPF preenchido e conferir no Asana se aparecem os 3 blocos separados e o documento da contraparte.
- Demandas antigas com task já criada: ao salvar qualquer edição (ou via Retry Sync) o `notes` é atualizado com o novo formato.

## Fora de escopo
- Não muda nenhum schema, RLS, UI do formulário, nem anexos.
- Não cria custom fields no Asana (mantém tudo em `notes` para não exigir configuração extra do workspace).
