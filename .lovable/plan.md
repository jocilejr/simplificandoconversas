

# Plano: Melhorar qualidade da transcrição Whisper

## Problema
O Whisper transcreve áudios em português com erros ("sete de feira" → "sexta-feira") porque não recebe o parâmetro `language`, forçando auto-detecção.

## Solução
Adicionar o campo `language=pt` no multipart form data enviado ao Whisper em `deploy/backend/src/routes/webhook.ts`.

### Alteração em `transcribeAudio` (~linha 120-125)
Adicionar um campo `language` no form data, logo após o campo `model`:

```typescript
// language field
parts.push(Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\npt\r\n`
));
```

### Resultado
- Whisper saberá que o áudio é em português
- Precisão muito maior para palavras como "sexta-feira", "pagamento", datas em PT-BR
- Sem impacto em performance ou custo

Após deploy, rebuild na VPS:
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

