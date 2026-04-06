

# Corrigir performance: paginação na aba de contatos + virtualização no preview de importação

## Problemas

1. **Aba de contatos carrega TODOS os e-mails** — sem paginação, renderiza milhares de linhas de uma vez
2. **Preview da importação em massa** — renderiza todas as linhas processadas numa tabela DOM, travando o navegador com listas grandes

## Solução

### 1. Paginação na aba de contatos (`useEmailContacts.ts` + `EmailContactsTab.tsx`)

**Hook:**
- Adicionar estado `perPage` (default: 10) e `page` (default: 1)
- Mover a busca para o banco com paginação server-side usando `.range(from, to)` e `.ilike()` para o search
- Buscar `count` total com `{ count: "exact", head: true }` para calcular páginas
- Expor `perPage`, `setPerPage`, `page`, `setPage`, `totalContacts`, `totalPages`

**Componente:**
- Adicionar seletor de "Exibir por página": 10, 50, 100, 500, Todos
- Adicionar navegação de página (anterior/próxima + indicador "página X de Y")
- Resetar para página 1 ao mudar search ou perPage

### 2. Limitar preview na importação em massa (`EmailContactsTab.tsx`)

- Mostrar no máximo 100 linhas no preview da tabela de processamento
- Exibir aviso tipo "Mostrando 100 de 3.500 — os contadores acima refletem o total"
- Os contadores (válidos, corrigidos, etc.) continuam calculados sobre o array completo

### Arquivos alterados

- `src/hooks/useEmailContacts.ts` — paginação server-side, estado perPage/page
- `src/components/email/EmailContactsTab.tsx` — seletor perPage, botões de página, limitar preview de importação

Sem mudanças de banco, migrations ou backend.

