

## Plano: Corrigir race condition nas permissões do colaborador

### Problema raiz

Em `useWorkspace.tsx`, o estado `isLoading` exposto ao resto da aplicação só rastreia o loading da query de **workspaces**, mas NÃO o loading da query de **isSuperAdmin**. 

Fluxo problemático no segundo acesso:
1. `isSuperAdmin` query inicia (loading, default `false`)
2. Workspaces query inicia com `enabled: !!user` — não espera `isSuperAdmin` resolver
3. React-query pode servir dados em cache da sessão anterior enquanto refetcha
4. Se o cache está parcialmente preenchido ou as queries resolvem em ordem diferente, o UI renderiza antes de ter os dados de permissão finais

Além disso, há um segundo problema na lógica de fallback (linha 164-166):
```typescript
if (Object.keys(permissions).length === 0) {
  return role === "operator" || role === "admin"; // ← dá acesso TOTAL se permissions é {} ou null
}
```
Se por qualquer motivo o `permissions` do membro vier como `null` ou `{}` (ex: cache parcial, Supabase retornando null temporariamente), um operador ganha acesso a TODAS as abas.

### Alterações em `src/hooks/useWorkspace.tsx`

**1. Rastrear o loading de `isSuperAdmin`**
Extrair `isLoading` da query de super admin e incluir no `isLoading` global:
```typescript
const { data: isSuperAdmin = false, isLoading: isSuperAdminLoading } = useQuery({...});
```

**2. Bloquear workspaces query até `isSuperAdmin` resolver**
Mudar o `enabled` da query de workspaces:
```typescript
enabled: !!user && !isSuperAdminLoading,
```

**3. Combinar loading states**
O `isLoading` exposto no contexto deve ser:
```typescript
const combinedLoading = isSuperAdminLoading || isWorkspacesLoading;
```

**4. Não mudar o fallback de permissions**
O fallback para `permissions === {}` com acesso baseado em role é intencional para retrocompatibilidade (membros antigos sem permissions granulares). A correção do loading já resolve a inconsistência visual.

### Resultado
- O sidebar e todas as gates de permissão esperam AMBAS as queries resolverem antes de renderizar
- Elimina a janela de tempo onde o UI renderiza com dados incompletos
- Colaboradores sempre veem apenas as abas que têm permissão

