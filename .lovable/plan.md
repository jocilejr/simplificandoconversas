

## Problema

O e-mail e CPF do lead vêm exclusivamente das transações. Ao deletar transações, esses dados somem. A tabela `conversations` já tem campo `email` mas não `document`, e nenhum dos dois é consultado no `useLeads.ts`.

## Solução

Persistir email e CPF na tabela `conversations` como **backup** — as fontes primárias de deduplicação continuam sendo **CPF e telefone** (sem usar email como chave de merge).

### 1. Migração: adicionar coluna `document` em `conversations` + backfill

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS document text;

-- Backfill: copiar CPF e email das transações para conversations que ainda não têm
UPDATE conversations c
SET
  email = COALESCE(c.email, sub.customer_email),
  document = sub.customer_document
FROM (
  SELECT DISTINCT ON (t.customer_phone)
    t.customer_phone, t.customer_email, t.customer_document
  FROM transactions t
  WHERE t.customer_document IS NOT NULL
  ORDER BY t.customer_phone, t.created_at DESC
) sub
WHERE c.document IS NULL
  AND replace(c.remote_jid, '@s.whatsapp.net', '') LIKE '%' || right(replace(sub.customer_phone, '+', ''), 8);
```

### 2. `src/hooks/useLeads.ts`

- **Query** (linha 72): incluir `email, document` no `.select()`
- **Construção do lead** (linhas 266-267): usar `c.email` / `c.document` como fallback quando não houver transações:
  ```
  customer_email: firstTxWithData?.customer_email || c.email || null,
  customer_document: cpf || c.document || null,
  ```
- **Merge de lead existente** (linhas 216-222): mesmo padrão — preencher do conversation se transação não tiver

### 3. `src/components/leads/LeadDetailDialog.tsx`

- No `saveEdits`, incluir `document` na atualização da tabela `conversations`:
  ```
  .update({ contact_name, phone_number, email, document })
  ```

### Resultado

- Deduplicação continua por **CPF → telefone → últimos 8 dígitos** (sem email)
- Email e CPF ficam salvos na conversa como backup
- Deletar transações não apaga mais esses dados do lead

