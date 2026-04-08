

# Normalizar telefones na tabela de Boletos Gerados

## Problema
Os telefones exibidos na tabela de transações (aba "Boletos Gerados") mostram números com zero à esquerda (ex: `027999937174`) porque o código atual só faz `replace(/\D/g, "")` sem remover zeros iniciais nem aplicar a normalização brasileira.

## Solução

### `src/components/transactions/TransactionsTable.tsx`
- Criar uma função utilitária `normalizePhone` no componente (ou importar de um shared util) que:
  1. Remove caracteres não-numéricos
  2. Remove zeros à esquerda (`replace(/^0+/, "")`)
  3. Adiciona prefixo `55` se o número tiver 10-11 dígitos
- Substituir todas as ocorrências de `customer_phone?.replace(/\D/g, "")` pela chamada a `normalizePhone(customer_phone)`
- Aplicar nos dois locais: card mobile (linha ~611) e no `RecoveryPopover` inline

### Locais afetados (mesmo arquivo)
- Linha 611: exibição desktop do telefone
- Linha 117 (`RecoveryPopover` inline text)
- Linha 344 (`BoletoQuickRecovery`)
- Linha 74 (`TransactionDetailDialog`)
- Linha 246 (`AutoRecoveryConfig`)

Todos esses arquivos serão atualizados para usar a mesma função de normalização.

### Função (inline ou shared)
```typescript
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "-";
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55")) {
    phone = "55" + phone;
  }
  return phone || "-";
}
```

Essa é a mesma lógica já usada no backend (`deploy/backend/src/lib/normalize-phone.ts`), agora replicada no frontend para exibição.

