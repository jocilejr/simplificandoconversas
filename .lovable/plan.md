

## Diagnóstico confirmado

### Problema 1: Transações PIX "desaparecem"
O filtro `filteredTxs` (linhas 169-193) é muito restritivo. Sem busca, ele só mostra:
- Órfãs (sem `customer_phone`)
- Transações com CPF do lead atual E phone do lead atual

Qualquer transação com `customer_phone` preenchido que não bata exatamente com o lead atual é **completamente oculta**. Exemplo: a transação das 17:55 tem `customer_phone = 89981340810`, então se você abrir o dialog com outro telefone, ela some. E se abrir com o mesmo telefone mas sem CPF resolvido (`leadCpf = null`), ela também some porque a condição `leadCpf && tx.customer_document === leadCpf` falha.

### Problema 2: Liberação manual
O código de `AreaMembros.tsx` está correto (upsert, normalizePhone, is_active). Preciso verificar se o problema é que o toast de sucesso aparece mas a lista não atualiza, ou se o upsert está falhando silenciosamente. Vou adicionar logging mais explícito.

---

## Plano de correção

### 1. `src/components/entrega/DeliveryFlowDialog.tsx` — Corrigir filtro de transações

**Mudança no `filteredTxs`** (linhas 169-193):
Sem busca, mostrar **TODAS** as transações, organizadas em 3 categorias:
1. **Órfãs** (sem phone) → clicáveis, vinculação completa
2. **Já contabilizadas** (CPF match ou phone match com lead atual) → clicáveis com badge verde
3. **Vinculadas a outro lead** (phone preenchido, não bate com lead atual) → visíveis com badge azul "Vinculada", desabilitadas

Isso resolve o problema de transações "desaparecendo" após vinculação.

**Mudança no `totalUnlinked`** (linhas 195-207):
Renomear para `totalVisible` e contar TODAS as transações (não só órfãs), para que "Ver mais" funcione.

**Mudança na ordenação** (linha 149):
Trocar `order("created_at")` por `order("paid_at", { ascending: false, nullsFirst: false })` para mostrar as mais recentemente pagas primeiro.

### 2. `src/pages/AreaMembros.tsx` — Melhorar feedback de erro

Adicionar `console.error` detalhado no `onError` da mutation para facilitar debugging futuro na VPS.

### Arquivos alterados
- `src/components/entrega/DeliveryFlowDialog.tsx`
- `src/pages/AreaMembros.tsx`

### Não alterar
- Banco, migrations, RLS, backend, types

### Verificação na VPS depois do redeploy
```bash
# Confirmar que o build está atualizado
docker exec deploy-nginx-1 sh -lc 'grep -c "totalVisible" /usr/share/nginx/html/assets/*.js && echo "BUILD OK" || echo "BUILD ANTIGO"'

# Testar: abrir Entrega Digital > PIX e verificar se todas as 42 transações aparecem
```

