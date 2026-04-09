# Fixes: Performance, Erro ao Criar Produto, Auto-Slug

## Problemas Identificados

1. **Lentidão**: Queries sem `staleTime` recarregam a cada render. AccessesTab e ProductsTab disparam queries simultaneamente mesmo quando a aba não está visível.
2. **Erro ao criar produto**: O `payload` envia `workspace_id` duas vezes (uma no spread, outra explícita), e o `value` pode ser `0` quando não preenchido. Precisa garantir que `workspace_id` está presente.
3. **Slug automático**: Ao digitar o nome, o slug deve ser gerado automaticamente (slugify).  
4. ao digitar o valor, deve ser formatado corretamente para o real, com R$ no inicio e formatação correta, com os primeiros digitos iniciando a direita e passando para a esquerda. Tudo bem profissional e refinado

## Alterações

### 1. ProductForm — Auto-slug + fix do erro (`src/components/entrega/ProductForm.tsx`)

- Adicionar `watch("name")` e `useEffect` para gerar slug automaticamente ao digitar o nome (apenas na criação, não na edição)
- Função slugify: `name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`
- Flag `slugManuallyEdited` para não sobrescrever se o usuário editou o slug manualmente
- Fix: remover `workspace_id` duplicado no insert, garantir que `workspace_id` é verificado antes de submeter

### 2. ProductsTab — Performance (`src/components/entrega/ProductsTab.tsx`)

- Adicionar `staleTime: 30_000` na query de produtos para evitar refetch desnecessário
- Adicionar `refetchOnWindowFocus: false`

### 3. AccessesTab — Performance (`src/components/entrega/AccessesTab.tsx`)

- Adicionar `staleTime: 30_000` nas queries
- Adicionar `refetchOnWindowFocus: false`

### 4. LinkGenerator — Performance (`src/components/entrega/LinkGenerator.tsx`)

- Adicionar `staleTime: 60_000` na query de `delivery-settings`

## Arquivos alterados


| Arquivo                                    | Mudança                                     |
| ------------------------------------------ | ------------------------------------------- |
| `src/components/entrega/ProductForm.tsx`   | Auto-slug ao digitar nome + fix payload     |
| `src/components/entrega/ProductsTab.tsx`   | `staleTime` + `refetchOnWindowFocus: false` |
| `src/components/entrega/AccessesTab.tsx`   | `staleTime` + `refetchOnWindowFocus: false` |
| `src/components/entrega/LinkGenerator.tsx` | `staleTime` na query de settings            |
