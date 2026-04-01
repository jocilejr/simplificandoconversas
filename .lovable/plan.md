

# Plano: Corrigir extensão do arquivo de áudio para transcrição Whisper

## Problema
O log mostra claramente o erro:

```
mediaUrl: '...4a58d131.ogg; codecs=opus'
[transcribe] OpenAI Whisper error 400: Invalid file format
```

O `mimetype` do áudio vem do WhatsApp como `"audio/ogg; codecs=opus"` (com parâmetro de codec). O código atual faz lookup direto no `extMap` e não encontra match, então usa `mimetype.split("/")[1]` que retorna `"ogg; codecs=opus"`. O arquivo é salvo como `uuid.ogg; codecs=opus` — extensão inválida.

## Solução
Duas correções simples no `deploy/backend/src/routes/webhook.ts`:

### 1. Limpar mimetype antes do lookup (linha ~51)
Extrair apenas a parte base do mimetype, removendo parâmetros como `; codecs=opus`:

```typescript
const rawMimetype = mediaMessage?.mimetype || "...";
const mimetype = rawMimetype.split(";")[0].trim();
```

### 2. Sanitizar extensão como fallback (linha ~56)
Garantir que o fallback também não contenha caracteres inválidos:

```typescript
const ext = extMap[mimetype] || mimetype.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
```

### Resultado
- `"audio/ogg; codecs=opus"` → mimetype limpo `"audio/ogg"` → ext `"ogg"`
- Arquivo salvo como `uuid.ogg` → Whisper aceita → transcrição funciona → lembretes via áudio funcionam

Após o deploy, será necessário rebuildar o backend na VPS:
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

