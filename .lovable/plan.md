

## Plano: Preencher automaticamente nome e CPF do lead no pagamento

### Problema raiz
O backend `member-access` já busca na tabela `customers` mas retorna apenas `name` — não retorna `document` (CPF). O `PaymentFlow` recebe `customerName` via props mas não recebe o CPF, e a segunda chamada a `/customer-info` falha por redundância.

### Solução (3 alterações cirúrgicas)

**1. Backend `member-access.ts` — retornar `document` do customer**

Na query à tabela `customers` (linha 84), adicionar o campo `document`:
```
.select("name, document, first_seen_at, total_paid, total_transactions")
```

No response JSON (linha 151-158), incluir `document`:
```typescript
customer: customerRes.data ? {
  name: customerRes.data.name || null,
  document: customerRes.data.document || null,  // ← NOVO
  ...
} : null,
```

**2. Frontend `MemberAccess.tsx` — armazenar e passar `customerDocument`**

- Adicionar estado `customerDocument`
- Extrair de `payload.customer?.document`
- Passar para `LockedOfferCard` e `PhysicalProductShowcase`

**3. Prop drilling até `PaymentFlow`**

- `LockedOfferCard` e `PhysicalProductShowcase`: aceitar e repassar `customerDocument`
- `PaymentFlow`: aceitar `customerDocument?: string`, pré-preencher `boletoCpf` imediatamente
- Remover a chamada ao `/customer-info` — os dados já vêm no carregamento inicial
- Se `customerName` e `customerDocument` existirem: mostrar card read-only com lápis
- Se faltar algum: mostrar os campos editáveis

### Verificação necessária na VPS

Antes de implementar, confirme que a coluna `document` existe na tabela `customers` da VPS:

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='document';"
```

Se não existir, rode:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "ALTER TABLE customers ADD COLUMN IF NOT EXISTS document TEXT;"
```

E depois:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

### Arquivos alterados
- `deploy/backend/src/routes/member-access.ts` — adicionar `document` ao select e ao response
- `src/pages/MemberAccess.tsx` — estado `customerDocument`, passar como prop
- `src/components/membros/LockedOfferCard.tsx` — aceitar e repassar `customerDocument`
- `src/components/membros/PhysicalProductShowcase.tsx` — aceitar e repassar `customerDocument`
- `src/components/membros/PaymentFlow.tsx` — aceitar `customerDocument`, pré-preencher, remover chamada a `/customer-info`

### Resultado
- Nome e CPF preenchidos automaticamente ao abrir o modal de boleto
- Zero chamadas extras ao backend
- Layout profissional com card de confirmação quando dados existem

