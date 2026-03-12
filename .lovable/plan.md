

## Problema Identificado

O fluxo é disparado com `remoteJid = @lid` (vindo do webhook). No `execute-flow.ts`, esse `@lid` é usado diretamente como `number` nas chamadas à Evolution API (`sendText`, `sendMedia`, etc.). A Evolution API **não aceita `@lid`** — precisa de um número de telefone real. Resultado: a tag é inserida (usa Supabase direto, não depende de Evolution) mas as mensagens falham silenciosamente.

## Causa Raiz

`deploy/backend/src/routes/execute-flow.ts`, linha 202:
```
const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;
```
Quando `remoteJid` é `@lid`, `jid` fica como `xxx@lid` e é passado como `number` para a Evolution API em todas as chamadas de envio.

## Solução

No `execute-flow.ts`, após resolver o `jid`, buscar o `phone_number` da conversa no banco. Usar o **phone_number** para chamadas à Evolution API e manter o `@lid` como `remote_jid` para rastreamento no banco.

### Alterações em `deploy/backend/src/routes/execute-flow.ts`

1. **Após linha 252** (lookup da conversa): buscar também `phone_number` da conversa
2. **Criar variável `sendNumber`**: se `jid` contém `@lid`, usar `phone_number` da conversa (formato `5588999999999@s.whatsapp.net`). Se `jid` já é `@s.whatsapp.net`, usar ele mesmo.
3. **Substituir `jid` por `sendNumber`** em todas as chamadas `evolutionRequest()` (sendText, sendMedia, sendWhatsAppAudio, sendPresence) — tanto na função `executeStep` quanto no loop principal (aiAgent, waitForClick)
4. **Manter `jid` (o @lid)** para operações no banco (upsert conversations, insert messages, contact_tags, flow_executions)

### Alterações em `deploy/backend/src/routes/webhook.ts`

5. **Linha 420** (`checkAndTriggerFlows`): ao disparar o flow, também enviar `resolvedPhone` no body para que o execute-flow tenha o telefone disponível mesmo sem precisar de lookup

### Alteração na edge function `supabase/functions/execute-flow/index.ts`

6. **Mesma lógica**: adicionar resolução de `sendNumber` a partir do `phone_number` da conversa, para manter paridade com o backend Express

