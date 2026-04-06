

# Plano: Lista de E-mails + Evento de Cadastro

## Situação atual
Hoje, os destinatários de campanhas vêm da coluna `email` da tabela `conversations` (contatos do WhatsApp que têm e-mail associado). Não existe um cadastro dedicado de e-mails para marketing.

## O que será feito

### 1. Nova tabela `email_contacts`
Tabela dedicada para armazenar contatos de e-mail, independente do WhatsApp:
- `id`, `user_id`, `email`, `name`, `tags` (text[]), `source` (manual/webhook/import), `status` (active/unsubscribed), `created_at`
- Índice único em `(user_id, email)` para evitar duplicatas
- RLS: user pode gerenciar seus próprios registros

### 2. Nova aba "Contatos" na página /email
- Aba com ícone `Users` entre Campanhas e Histórico
- Lista de e-mails cadastrados com: nome, e-mail, tags, origem, data de cadastro, status
- Busca por nome/e-mail
- Botão "Adicionar" — formulário para cadastro manual (nome + e-mail + tags)
- Botão "Importar CSV" — upload de CSV com colunas nome, email
- Opção de excluir contatos
- Exibir total de contatos ativos

### 3. Evento no webhook de e-mail (backend)
Novo evento `register_email` no endpoint `/api/email/webhook/inbound`:
```
POST /api/email/webhook/inbound
X-API-Key: <chave>
{
  "event": "register_email",
  "data": {
    "email": "contato@exemplo.com",
    "name": "Nome",
    "tags": ["lead", "site"]
  }
}
```
- Faz upsert na tabela `email_contacts`
- Retorna `{ ok: true, contactId: "..." }`

### 4. Atualizar campanhas para usar `email_contacts`
Alterar o backend `/api/email/campaign` para buscar destinatários **também** da tabela `email_contacts` (além de `conversations`), mesclando os dois sem duplicatas.

### 5. Hook `useEmailContacts.ts`
- CRUD via Supabase direto (select, insert, delete)
- Importação de CSV
- Busca e filtro por tags

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `email_contacts` com RLS |
| `src/hooks/useEmailContacts.ts` | **Novo** — hook de CRUD |
| `src/components/email/EmailContactsTab.tsx` | **Novo** — aba de contatos |
| `src/pages/EmailPage.tsx` | Adicionar aba "Contatos" |
| `deploy/backend/src/routes/email.ts` | Adicionar evento `register_email` + mesclar contatos em campanhas |

