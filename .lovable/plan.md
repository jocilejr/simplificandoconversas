

# Corrigir webhook OpenPix — Tratar evento TRANSACTION_RECEIVED

## Problema identificado
Os logs mostram dois problemas:

1. **Evento errado**: O webhook recebe `OPENPIX:TRANSACTION_RECEIVED`, mas o código só trata `OPENPIX:CHARGE_COMPLETED` e `OPENPIX:CHARGE_EXPIRED`
2. **correlationID vazio**: No evento `TRANSACTION_RECEIVED`, os dados da transação vêm em `body.transaction` (não em `body.charge`), por isso o correlationID está vazio

## Solução

### `deploy/backend/src/routes/payment-openpix.ts`

Adicionar tratamento para o evento `OPENPIX:TRANSACTION_RECEIVED`:

- Extrair dados de `body.transaction` (não `body.charge`)
- Campos relevantes do payload: `transaction.value` (centavos), `transaction.customer`, `transaction.charge` (contém correlationID), `transaction.endToEndId`, `transaction.time`
- Se não houver correlationID, usar `transaction.endToEndId` ou `transaction.globalID` como `external_id`
- Resolver `user_id` via fallback (buscar primeiro usuário com conexão openpix ativa)
- Inserir transação com `status: 'aprovado'`, `source: 'openpix'`

Lógica simplificada:
```
if (event === "OPENPIX:TRANSACTION_RECEIVED") {
  const tx = body.transaction || body.pix || {};
  const charge = tx.charge || body.charge || {};
  const corrId = charge.correlationID || tx.endToEndId || tx.globalID || `openpix-${Date.now()}`;
  const valueCents = tx.value || charge.value || 0;
  const customer = tx.customer || charge.customer || {};
  
  // Verificar se já existe
  // Se não, INSERT com userId resolvido via platform_connections
}
```

### Arquivo modificado
1. `deploy/backend/src/routes/payment-openpix.ts`

### Pós-deploy (VPS)
```bash
docker compose up -d --build backend
```

