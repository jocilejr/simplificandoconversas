

## Plano: Tornar a aba Contatos funcional

### Fonte de dados
Os contatos já existem na tabela `conversations` (contact_name, phone_number, remote_jid, instance_name). Vamos agregar por `remote_jid` para evitar duplicatas entre instâncias. Tags vêm de `contact_tags`.

### Alterações

**1. Hook `src/hooks/useContacts.ts`** (novo)
- Query que busca contatos únicos de `conversations` agrupando por `remote_jid`, pegando o mais recente (por `last_message_at`)
- Join com `contact_tags` para exibir tags de cada contato
- Mutation para criar contato manualmente (insert em `conversations`)
- Mutation para importar CSV (parse no client, batch insert)
- Busca textual (filtro client-side por nome/telefone)
- Filtro por tag

**2. Página `src/pages/Contacts.tsx`** (reescrever)
- Tabela com colunas: Nome, Telefone, Instância, Tags, Última mensagem
- Campo de busca filtrando em tempo real
- Botão de filtro por tag (popover com lista de tags existentes)
- Dialog "Novo Contato" (nome + telefone + instância)
- Dialog "Importar CSV" (upload de arquivo, parse de colunas nome/telefone)
- Estado vazio quando não há contatos
- Paginação client-side (50 por página)

**3. Nenhuma alteração de banco** — as tabelas `conversations` e `contact_tags` já existem com RLS adequado.

### Fluxo
- Ao abrir a página, carrega contatos do `conversations` desduplicados
- Busca filtra por nome ou telefone
- "Novo Contato" insere um registro em `conversations` com os dados básicos
- "Importar CSV" faz parse do arquivo e insere múltiplos registros
- Tags são exibidas como badges coloridos ao lado de cada contato

