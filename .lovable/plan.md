

# Plano: Ignorar áudios com mais de 5 minutos

## Alteração em `deploy/backend/src/routes/webhook.ts`

Na função `transcribeAudio`, após ler o arquivo (linha 102), verificar o tamanho do arquivo e ignorar se exceder ~5 minutos.

Como não é trivial obter a duração exata de um OGG sem biblioteca, usaremos o **tamanho do arquivo** como proxy. Áudios OGG do WhatsApp tipicamente usam ~6-8 KB/s (Opus codec). 5 minutos ≈ 300s × 8KB = ~2.4 MB. Usaremos **3 MB** como limite seguro.

### Código a adicionar após `const fileBuffer = await fs.readFile(localPath);` (linha 102):

```typescript
// Skip audios longer than ~5 minutes (3MB ≈ 5min at WhatsApp Opus bitrate)
const MAX_AUDIO_SIZE = 3 * 1024 * 1024; // 3MB
if (fileBuffer.length > MAX_AUDIO_SIZE) {
  console.log(`[transcribe] Skipping large audio (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB > 3MB limit): ${localPath}`);
  return null;
}
```

### Resultado
- Áudios > 3MB (~5min) são ignorados automaticamente
- Log registra o skip para debug
- Economiza tokens do Whisper

Após deploy, rebuild na VPS:
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

