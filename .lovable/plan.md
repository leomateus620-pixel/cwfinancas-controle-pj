## Diagnóstico — onde estão as demandas

As demandas **foram salvas corretamente** no banco (e sincronizadas com o Asana). Confirmei diretamente na tabela `financial_demands`:

```
DM-202605-0008  teste leo                  recebida   synced   (criada por CW Finanças cliente)
DM-202605-0007  Pagar contador             recebida   synced   (criada por CW Finanças cliente)
DM-202605-0006  teste                      recebida   synced
DM-202605-0005  teste                      recebida   synced
DM-202605-0004  teste                      recebida   synced   (Leonardo Stroschein)
DM-202605-0003  teste                      recebida   synced   (Leonardo Stroschein)
DM-202605-0002  teste 2                    recebida   synced   (Leonardo Stroschein)
DM-202605-0001  teste                      recebida   synced   (Leonardo Stroschein)
```

Logo, **não há falha no fluxo de criação nem na integração Asana**. O problema está em **quem pode enxergar essas demandas na Central**.

## Causa raiz

A tabela `financial_demands` tem a seguinte política de leitura (RLS):

```sql
SELECT USING ( is_internal() OR created_by = auth.uid() )
-- is_internal() = has_role(uid, 'admin') OR has_role(uid, 'manager')
```

Ou seja, só vê **todas as demandas** quem tem papel `admin` ou `manager`. Vendo a tabela `user_roles`:

```
0a7ac1ec…  CW Finanças (perfil cliente)        → cliente
ae3ae0d0…  Leonardo Stroschein                  → user
22a77402…  Camila Weinert                       → user
6841723d…  Ana Oliveira                         → user
6f25eb37…  Leonardo Mateus Stroschein           → user
c9158ca3…  Leonardo                             → user
dd7f331a…  Leonardo Mateus Stroschein           → user
7a8723f4…  Ricardo Zimmermann                   → user
7b421592…  Josivan (LinkEvents)                 → user
```

**Nenhum usuário tem papel `admin` nem `manager`.** Resultado: cada usuário só enxerga as demandas que ele mesmo criou. Por isso a DM-0007 e a DM-0008 (criadas pelo perfil "CW Finanças cliente") **não aparecem** quando você acessa a Central com a sua conta operadora — elas existem, estão no Asana, mas a RLS bloqueia a leitura.

A demanda DM-0008 inclusive foi sincronizada com o Asana com link apontando para `id-preview--...lovable.app`, indicando que o cliente a criou pelo ambiente de preview enquanto você está no ambiente publicado — mas isso é só um detalhe; o dado está lá.

## Correção proposta

Promover a equipe operadora da CW Finanças para `admin`, para que a Central de Demandas (Dashboard + Recebidas + Aprovações) mostre **todas as demandas de todos os clientes**. Nada do fluxo de criação, formulário, animação 3D ou Asana é alterado.

### Migração (1 passo)

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('ae3ae0d0-f0ef-4c99-a388-1e472a3888fc', 'admin'),  -- Leonardo Stroschein
  ('22a77402-8b27-4ea5-8787-8d18cf9de417', 'admin'),  -- Camila Weinert
  ('6841723d-77ef-470f-bf2b-a477adadfdc6', 'admin'),  -- Ana Oliveira
  ('6f25eb37-1653-4669-b9a9-e9fcf7303550', 'admin'),  -- Leonardo Mateus
  ('c9158ca3-15ff-4a24-918d-512e701eca31', 'admin'),
  ('dd7f331a-751e-434f-8430-232247339729', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

> Posso ajustar a lista — se você quiser que apenas **um** usuário seja admin (ex.: somente o seu login principal), me diga o e-mail/nome e eu restrinjo. Os demais usuários "operadores" da CW podem ficar como `manager` (também enxergam tudo) em vez de `admin`, se preferir separar privilégios.

### Verificação após aplicar
1. Recarregar `/demands` → as 8 demandas aparecem na inbox.
2. Abrir DM-0008 e DM-0007 → detalhes carregam normalmente.
3. Nenhuma alteração no fluxo de criação cliente → Asana (já está funcionando).

## O que **não** será alterado

- Formulário de criação de demanda
- Etapa de Identificação e tela de sucesso 3D
- Integração Asana (continua igual; as tarefas já estão sincronizando)
- RLS de outras tabelas, schema, hooks ou telas existentes

## Pergunta antes de executar

Quer que **todos** os 6 usuários CW Finanças listados acima virem `admin`, ou prefere apontar apenas 1–2 contas? Se não responder, sigo com a lista completa acima como `admin`.
