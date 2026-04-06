

# Adicionar Public Key à integração Mercado Pago

## Problema
A integração do Mercado Pago exige dois campos: **Access Token** (para chamadas server-side à API) e **Public Key** (para inicialização client-side do SDK/checkout). Atualmente só pede o Access Token.

## Alterações

### 1. `src/components/settings/IntegrationsSection.tsx`
- Adicionar campo `public_key` na definição do Mercado Pago:
```ts
fields: [
  { key: "access_token", label: "Access Token", placeholder: "APP_USR-...", type: "password" },
  { key: "public_key", label: "Public Key", placeholder: "APP_USR-...", type: "password" },
]
```

### 2. `deploy/backend/src/routes/payment.ts`
- Alterar `getMPToken()` para buscar o `access_token` da tabela `platform_connections` em vez da variável de ambiente, usando o `user_id` do JWT
- Adicionar fallback para a env var `MERCADOPAGO_ACCESS_TOKEN` caso não exista na tabela
- Retornar a `public_key` no endpoint `/status` ou em um novo endpoint `/config` para que o frontend possa usá-la se necessário

### 3. `src/hooks/useCreatePayment.ts`
- Nenhuma alteração necessária — o frontend já envia via backend, que usa o token server-side

## Resultado
O dialog de configuração do Mercado Pago passará a pedir Access Token **e** Public Key. Ambos serão salvos no `credentials` JSONB da tabela `platform_connections`.

