

## Diagnóstico

O `SUPABASE_URL` do backend aponta para `http://nginx:80`. Quando o webhook chama `supabase.storage.from("chatbot-media").upload()`, o supabase-js faz uma requisição HTTP para `http://nginx:80/storage/v1/object/chatbot-media/...`, que o Nginx proxeia para o container `storage:5000`. O container Storage usa o role `supabase_storage_admin` internamente para inserir em `storage.objects`, e esse role **não** tem `BYPASSRLS`. As tentativas de corrigir via SQL não funcionaram (possivelmente o container Storage cacheia conexões ou tem lógica interna de RLS).

## Nova abordagem: Upload direto via HTTP para o Storage API

Em vez de usar `supabase.storage` (que depende do roteamento correto e da autenticação interna do container Storage), o webhook fará o upload **diretamente** para o container Storage via HTTP (`http://storage:5000`) usando o `SERVICE_ROLE_KEY` no header `Authorization: Bearer`. Isso contorna completamente o problema de RLS porque o Storage API respeita o JWT do service_role.

## Alterações

### 1. `deploy/backend/src/routes/webhook.ts` -- Função `downloadAndUploadMedia`

Substituir o uso de `supabase.storage.from().upload()` por uma chamada HTTP direta ao Storage API:

```typescript
// Em vez de:
const { error: uploadError } = await supabase.storage
  .from("chatbot-media")
  .upload(fileName, bytes, { contentType: mimetype, upsert: false });

// Fazer:
const storageUrl = process.env.STORAGE_URL || "http://storage:5000";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const uploadResp = await fetch(
  `${storageUrl}/object/chatbot-media/${fileName}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": mimetype,
    },
    body: bytes,
  }
);
```

A URL pública continua sendo construída manualmente (como já é feito), usando `API_URL + /storage/v1/object/public/chatbot-media/...`.

### 2. Remover parâmetro `supabase` da função

A função `downloadAndUploadMedia` não precisará mais do cliente Supabase, simplificando a assinatura.

### Resultado esperado

- O upload vai direto ao container Storage na porta 5000, com JWT de service_role
- Sem dependência de RLS, roles PostgreSQL ou policies em `storage.objects`
- Nenhuma alteração de infraestrutura/SQL necessária na VPS -- apenas rebuild do backend

