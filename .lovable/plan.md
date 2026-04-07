RESOLVA PROBLEMA DE NÃO ESTAR CONSEGUINDO CRIAR NOVOS WORKSPACE POR LOW LEVEL SECURITY

&nbsp;

# Otimização de Performance pós-Workspace

## Diagnóstico

A lentidão tem **3 causas principais**:

### 1. RLS com funções SECURITY DEFINER em TODAS as queries

Cada query agora passa por `is_workspace_member()`, `can_write_workspace()`, etc. Essas funções fazem sub-queries na tabela `workspace_members` a cada chamada. Sem índice adequado em `workspace_members(user_id, workspace_id)`, isso é lento.

### 2. QueryClient sem `staleTime` — refetch excessivo

O `QueryClient` é criado sem configuração: `new QueryClient()`. Isso significa `staleTime: 0` — cada vez que um componente monta, TODAS as queries são refetched. Navegação entre páginas causa dezenas de requests simultâneos.

### 3. Dashboard busca TODAS as mensagens do período

`useDashboardStats` linha 112-123 faz `select("direction")` sem `head: true` — baixa TODOS os registros de mensagens para contar sent/received no cliente. Com milhares de mensagens, isso é muito pesado.

---

## Plano de Correção

### Arquivo 1: `src/App.tsx`

Configurar o `QueryClient` com `staleTime` e `gcTime` para reduzir refetches:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s antes de considerar dados "stale"
      gcTime: 5 * 60 * 1000,  // 5 min no cache
      refetchOnWindowFocus: false,
    },
  },
});
```

### Arquivo 2: `src/hooks/useDashboardStats.ts`

Substituir a query de mensagens (que baixa todos os registros) por duas queries `count` separadas (sent/received), usando `head: true`:

```ts
// Em vez de baixar todas as mensagens:
// select("direction") → filtrar no cliente
// Usar duas queries count:
// select("*", { count: "exact", head: true }).eq("direction", "outbound")
// select("*", { count: "exact", head: true }).eq("direction", "inbound")
```

### Arquivo 3: `deploy/migrate-workspace.sql`

Adicionar índice composto na tabela `workspace_members` para acelerar as funções RLS:

```sql
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace 
ON public.workspace_members(user_id, workspace_id);
```

### Resultado esperado

- Menos requests ao navegar entre páginas (staleTime 30s)
- Dashboard não baixa mais milhares de linhas de mensagens
- Queries RLS executam mais rápido com o índice composto
- Instruções para rodar na VPS: apenas o índice SQL precisa ser aplicado manualmente