

# Corrigir autenticação do webhook de e-mail

## Problema
O webhook `/api/email/webhook/inbound` exige o header `X-API-Key`, que é a mesma chave gerada em **Configurações → API**. Porém:

1. **Bug no código**: o webhook procura a chave com `platform = "api_key"` na tabela `platform_connections`, mas a chave é salva com `platform = "custom_api"`. A autenticação sempre falha.
2. **Configuração do n8n**: o `Content-Type` está como Query Parameter (deveria ser Header), e "Send Headers" está desligado — o `X-API-Key` não está sendo enviado.

## Correção

### Arquivo: `deploy/backend/src/routes/email.ts` (linhas 510-526)
Corrigir a busca na `platform_connections` para usar `platform = "custom_api"` e comparar via `credentials->>api_key`, igual ao middleware da Platform API:

```typescript
if (!userId) {
  const { data: pc } = await supabase
    .from("platform_connections")
    .select("user_id")
    .eq("platform", "custom_api")
    .eq("credentials->>api_key", apiKey)
    .maybeSingle();
  if (pc) userId = pc.user_id;
}
```

### Configuração no n8n (manual)
Após o deploy, no n8n você precisa:
1. Ativar **Send Headers**
2. Adicionar header `X-API-Key` com o valor da chave gerada em **Configurações → API**
3. Mover `Content-Type: application/json` de Query Parameters para **Headers**

