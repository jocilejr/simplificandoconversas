

# Simplificação do Follow Up — Fonte de dados = Boletos Gerados

## O que muda

O Follow Up deixa de ter lógica própria de filtragem (source, metadata, boleto_file) e passa a usar **exatamente o mesmo filtro** da aba "Boletos Gerados" na página de Transações:

```
type = "boleto" AND status = "pendente"
```

Quando um boleto muda de `pendente` para `aprovado`, ele simplesmente sai da query — remoção automática sem lógica extra.

O Follow Up fica **desacoplado** do webhook e do dispatch. Ele apenas lê o que já existe no banco e aplica a régua.

## Alterações

### 1. `src/hooks/useBoletoRecovery.ts` — Simplificar query

**Antes**: Filtro complexo com `source = "mercadopago"`, paginação manual, filtro por `metadata.boleto_file`.

**Depois**: Query simples e direta:
```typescript
const { data, error } = await supabase
  .from("transactions")
  .select("*")
  .eq("workspace_id", workspaceId)
  .eq("type", "boleto")
  .eq("status", "pendente")
  .order("created_at", { ascending: false });
```

- Remove filtro de `source`
- Remove filtro de `metadata.boleto_file`
- Remove paginação manual (se houver mais de 1000, adicionar `.limit(2000)` ou paginar)
- Mantém toda a lógica de régua (rules), contatos do dia, e cálculo de vencimento como está

### 2. `src/hooks/useBoletoRecovery.ts` — Adicionar realtime

Para que boletos aprovados sumam automaticamente sem refresh manual:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("followup-transactions")
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "transactions",
    }, () => {
      queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [queryClient]);
```

### 3. Backend — Sem alterações

O `recovery-dispatch.ts` e `recovery-enqueue.ts` continuam existindo para o envio automático (quando habilitado). O Follow Up no frontend é apenas uma **visualização** dos boletos pendentes com a régua aplicada. São dois sistemas independentes:

- **Follow Up (frontend)**: lê boletos pendentes + aplica régua + mostra na UI
- **Recovery dispatch (backend)**: envia mensagens automaticamente quando um boleto é criado (se habilitado)

O frontend não precisa saber nem se conectar com o dispatch.

## Resultado esperado

```
Follow Up query:
  transactions WHERE type = "boleto" AND status = "pendente"
  → Aplica régua de cobrança (boleto_recovery_rules)
  → Mostra no dashboard

Boleto pago (status → aprovado):
  → Sai automaticamente da query
  → UI atualiza via realtime
```

