

# Plano: Remover Dashboard e ajustar redirecionamento padrão por role

## Problema
- A rota `/dashboard` ainda existe no `App.tsx` mesmo sem estar na sidebar
- O redirect padrão (`/`) aponta para `/relatorio` fixo
- O `PermissionGate` redireciona para `/dashboard` quando o usuário não tem permissão

## Alterações

### 1. `src/App.tsx`
- **Remover** a rota `/dashboard` e o import do `Dashboard`
- **Substituir** `<Route path="/" element={<Navigate to="/relatorio" replace />} />` por um componente que decide a rota com base no role:
  - Super Admin → `/relatorio`
  - Qualquer outro → `/transacoes`
- **Adicionar** redirect legacy: `<Route path="/dashboard" element={<Navigate to="/" replace />} />` para não quebrar bookmarks

### 2. `src/components/PermissionGate.tsx`
- Trocar o redirect de `/dashboard` para `/relatorio` (ou melhor, para `/`) que já resolve pelo role

### 3. Criar componente inline `DefaultRedirect`
Pequeno componente que usa `useWorkspace()` para decidir:
```typescript
function DefaultRedirect() {
  const { isSuperAdmin, isLoading } = useWorkspace();
  if (isLoading) return null;
  return <Navigate to={isSuperAdmin ? "/relatorio" : "/transacoes"} replace />;
}
```

### 4. Remover `src/pages/Dashboard.tsx`
- Deletar o arquivo por completo

### 5. `src/hooks/useWorkspace.tsx`
- Remover `"dashboard"` da lista `ALL_PERMISSIONS` (já não é usado na sidebar)

## Arquivos modificados
- `src/App.tsx` — remover rota e import, adicionar redirect inteligente
- `src/components/PermissionGate.tsx` — trocar fallback de `/dashboard` para `/`
- `src/pages/Dashboard.tsx` — deletar
- `src/hooks/useWorkspace.tsx` — remover permission `dashboard`

