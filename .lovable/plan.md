

## Diagnostico

O upload de midia agora funciona (`Media uploaded: success`). O problema e que o `console.log("Inserting message:", ...)` aparece nos logs, mas o resultado do `supabase.from("messages").insert()` **nao e verificado para erros**. Se o insert falhar (por exemplo, por RLS na tabela `messages` ou constraint violation), o erro e engolido silenciosamente.

## Plano

### 1. Adicionar log de erro no insert de mensagens (`deploy/backend/src/routes/webhook.ts`)

Capturar e logar o resultado do insert para identificar se ha um erro silencioso:

```typescript
const { error: insertError } = await supabase.from("messages").insert({...});
if (insertError) {
  console.error("Message insert error:", insertError.message);
}
```

### 2. Adicionar log de erro no insert/upsert de conversas

Mesma verificacao no upsert de conversations (linha 249-253) para garantir que o conversation upsert tambem esta funcionando.

### Resultado esperado

Com os logs de erro adicionados, ao enviar uma nova midia pelo WhatsApp, os logs do backend vao mostrar claramente se o insert esta falhando e qual o erro exato (possivelmente RLS na tabela `messages` ou outro constraint). Isso vai direcionar a correcao definitiva.

