

## Endpoint de Geração de Boleto via API

### O que sera feito

Criar um novo endpoint `POST /api/platform/generate-payment` na Platform API, autenticado via `X-API-Key`, que gera cobranças (boleto ou PIX) no Mercado Pago e retorna os dados de pagamento (URL, código de barras, QR Code).

Isso permite que sistemas externos (n8n, automacoes, etc.) criem cobranças sem precisar de login JWT.

### Payload esperado

```json
{
  "customer_name": "João Silva",
  "customer_phone": "11999999999",
  "customer_document": "12345678900",
  "amount": 80.00,
  "description": "Produto X",
  "type": "boleto"
}
```

- `customer_name` e `amount`: obrigatórios
- `type`: `"boleto"` ou `"pix"` (default: `"pix"`)
- `customer_phone`, `customer_document`, `description`: opcionais

### Resposta

```json
{
  "success": true,
  "transaction_id": "uuid",
  "payment_url": "https://...",
  "barcode": "23793...",
  "qr_code": "00020126...",
  "qr_code_base64": "data:image/png;base64,...",
  "mp_id": 152800261621,
  "status": "pendente"
}
```

### Detalhe tecnico

| Arquivo | Alteracao |
|---------|-----------|
| `deploy/backend/src/routes/platform-api.ts` | Adicionar `POST /api/platform/generate-payment` reutilizando a lógica de criação do `/payment/create` (resolve email, gera endereço aleatório para boleto, chama MP API, salva transação, faz download do PDF do boleto) |

O endpoint:
1. Autentica via `X-API-Key` (mesmo padrão dos outros endpoints da Platform API)
2. Busca o token do Mercado Pago do usuário em `platform_connections`
3. Resolve email via `conversations` com fallback
4. Para boletos: gera endereço aleatório via CEP
5. Chama `POST /v1/payments` na API do MP
6. Salva a transação no banco
7. Para boletos: faz download e salva o PDF
8. Retorna os dados de pagamento

A lógica sera extraida/reutilizada do `payment.ts` existente (funções `getMPTokenForUser`, `downloadAndSaveBoletoPdf`, `getRandomCep`, `lookupCep`).

### Apos deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Testar:
```bash
curl -X POST https://api.chatbotsimplificado.com/api/platform/generate-payment \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_API_KEY" \
  -d '{"customer_name":"Teste","amount":1,"type":"pix"}'
```

