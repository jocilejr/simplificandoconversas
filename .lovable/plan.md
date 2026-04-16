

## Plano: substituir input de URL por upload direto

### Mudança
No `GroupScheduledMessageForm.tsx`, no bloco do tipo de mensagem `image|video|document|audio|sticker` (linhas 282-306), trocar o `Input` que pede "URL da mídia" pelo componente `MediaUpload` já existente.

### Detalhes
- Importar `MediaUpload` de `@/components/chatbot/MediaUpload`
- Mapear o `accept` por tipo:
  - image → `image/*`
  - video → `video/*`
  - audio → `audio/*`
  - sticker → `image/webp,image/png`
  - document → `.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip`
- Passar `value={mediaUrl}` e `onChange={setMediaUrl}`
- O componente envia via `whatsapp-proxy` (action `media-upload`) → salva em `/media-files/{userId}/` na VPS (permanente, mesmo storage da importação de backup) e devolve URL pública servida pelo Nginx em `/media/...`

### Compatibilidade
- O campo `mediaUrl` no `content` continua igual — nenhuma mudança no backend, no scheduler ou na fila
- Edição de mensagens existentes continua funcionando: se já houver uma URL salva, o `MediaUpload` exibe o preview com botão para remover/trocar

### Arquivos
| Arquivo | Mudança |
|---|---|
| `src/components/grupos/GroupScheduledMessageForm.tsx` | Trocar `Input` de URL pelo `MediaUpload` no bloco de mídias |

### Resultado
- Upload direto do arquivo no modal "Nova Mensagem Agendada"
- Arquivo armazenado de forma permanente no volume `chatbot_media` da VPS
- URL pública pronta para uso pela Evolution API

