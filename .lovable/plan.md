

# Adicionar produtos liberados e link de acesso ao card do Lead

## O que muda

No `LeadDetailDialog.tsx`, adicionar uma nova seção "Produtos Liberados" entre os dados pessoais e o resumo financeiro, que:

1. **Busca produtos liberados** via query na tabela `member_products` filtrando pelo telefone do lead (usando `generatePhoneVariations` como já feito no `MemberClientCard`)
2. **Lista cada produto** com nome, status (ativo/inativo) e badge visual
3. **Link de acesso copiável** — gera o link `/membros/{phone}` e exibe um botão "Copiar link de acesso" no topo da seção, igual ao padrão do `MemberClientCard`

## Arquivo: `src/components/leads/LeadDetailDialog.tsx`

### Mudanças:
- Importar `generatePhoneVariations` de `@/lib/phoneNormalization`
- Importar `Package` ou `ShoppingBag` de lucide-react
- Adicionar `useQuery` para buscar `member_products` com join em `delivery_products` para o nome, filtrando por variações de telefone do lead e `workspace_id`
- Nova seção `CollapsibleSection` com icon `ShoppingBag`, título "Produtos Liberados", contendo:
  - Botão "Copiar link de acesso" no topo (com feedback visual de "Copiado")
  - Lista de produtos com badge ativo/inativo
  - Estado vazio "Nenhum produto liberado"

### Posição no layout:
Após "Dados Pessoais", antes de "Resumo Financeiro" (entre linhas ~229 e ~232)

### Query:
```typescript
const { data: memberProducts = [] } = useQuery({
  queryKey: ["lead-member-products", lead?.remote_jid, workspaceId],
  queryFn: async () => {
    const phone = lead!.phone_number || formatPhone(lead!.remote_jid);
    const variations = generatePhoneVariations(phone);
    if (!variations.length) return [];
    const { data } = await supabase
      .from("member_products")
      .select("id, normalized_phone, is_active, delivery_products(name)")
      .eq("workspace_id", workspaceId!)
      .in("normalized_phone", variations);
    return data || [];
  },
  enabled: open && !!lead && !!workspaceId,
});
```

### UI da seção:
- `CollapsibleSection` com contagem de produtos
- Botão copiável com o link `/membros/{phone}`
- Chips/badges para cada produto com nome e status

