

# Corrigir dados do cliente no webhook TRANSACTION_RECEIVED

## Problema
A transação chega via webhook `OPENPIX:TRANSACTION_RECEIVED` e é salva com sucesso, mas os campos `customer_name` e `customer_document` ficam vazios. O código atual extrai o cliente de `tx.customer || charge.customer`, mas o payload real da OpenPix pode estruturar esses dados em caminhos diferentes (ex: `body.payer`, `tx.payer`, ou o campo `taxID` pode estar como string direta em vez de objeto `{taxID, type}`).

## Solução

### `deploy/backend/src/routes/payment-openpix.ts`

1. **Adicionar log completo do payload** para diagnosticar a estrutura real:
   ```
   console.log("[openpix webhook] FULL BODY:", JSON.stringify(body, null, 2));
   ```

2. **Expandir extração de dados do cliente** para cobrir todas as variações do payload OpenPix:
   - Tentar múltiplos caminhos: `tx.customer`, `charge.customer`, `body.customer`, `tx.payer`, `body.payer`
   - Para o nome: `customer.name || tx.payer?.name || charge.additionalInfo?.[0]?.value`
   - Para o documento (CPF): verificar se `taxID` é string ou objeto (`customer.taxID?.taxID || customer.taxID || customer.cpf || customer.document`)
   - Para telefone: `customer.phone || tx.payer?.phone`
   - Para email: `customer.email || tx.payer?.email`

3. **Aplicar a mesma lógica expandida** nos handlers de `CHARGE_COMPLETED` e `CHARGE_EXPIRED`

### Arquivo modificado
- `deploy/backend/src/routes/payment-openpix.ts`

### Pós-deploy (VPS)
```bash
docker compose up -d --build backend
```

Depois, fazer um novo pagamento teste e verificar os logs com:
```bash
docker compose logs -f backend 2>&1 | grep -A 30 "FULL BODY"
```

Isso mostrará a estrutura exata do payload para confirmar que os dados estão sendo extraídos corretamente.

