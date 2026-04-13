

## Plano: Limpar áudios de conversas WhatsApp após 24h

### Diagnóstico confirmado

O `webhook.ts` (linha 68-73) salva **toda mídia recebida** de conversas WhatsApp em `/media-files/{userId}/` — a mesma raiz dos arquivos permanentes. Após a transcrição, o arquivo fica no disco para sempre. Dos 308 áudios, apenas 47 são permanentes (fluxos + campanhas). Os ~261 restantes são de conversas e podem ser deletados após 24h.

### Solução: duas mudanças

#### 1. `webhook.ts` — Salvar mídia de conversas em subpasta `tmp/`

Alterar a função `downloadAndUploadMedia` (linha 68) para salvar em `/media-files/{userId}/tmp/` ao invés de `/media-files/{userId}/`:

```typescript
// ANTES:
const mediaDir = path.join("/media-files", userId);

// DEPOIS:
const mediaDir = path.join("/media-files", userId, "tmp");
```

A URL na tabela `messages` continuará funcionando por 24h. Após a limpeza, a mídia some mas a transcrição e o texto permanecem no banco.

Arquivos permanentes (uploads via `media-upload` do frontend — fluxos, campanhas, área de membros) continuam salvando na raiz `/media-files/{userId}/`, sem alteração.

#### 2. `sanitize-storage.sh` — Já está correto

O script atualizado já deleta arquivos em `*/tmp/*` com mais de 1 dia. Nenhuma mudança necessária aqui.

### Resultado

- Áudios/imagens/vídeos de conversas WhatsApp → salvos em `tmp/`, deletados automaticamente após 24h
- Áudios de fluxos, campanhas, membros → continuam na raiz, nunca deletados
- Economia estimada: ~261 arquivos de áudio + imagens/vídeos de conversas que estavam acumulando

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `deploy/backend/src/routes/webhook.ts` | Linha 68: `path.join("/media-files", userId)` → `path.join("/media-files", userId, "tmp")` |

