

# Plano: Transcrição de áudio na IA Escuta

## Problema
A IA Escuta só analisa mensagens de texto (`messageContent`). Quando chega um áudio, `messageContent` é vazio e a função `checkAndAutoListen` não é chamada (a condição `if (!fromMe && messageContent)` falha).

## Solução
1. Quando chegar uma mensagem de áudio inbound, transcrever o áudio usando a API Whisper da OpenAI (o usuário já tem `openai_api_key` configurada)
2. Passar o texto transcrito para a `checkAndAutoListen` como se fosse uma mensagem de texto

## Alterações

### `deploy/backend/src/routes/webhook.ts`

**1. Nova função `transcribeAudio`** (~linha 80):
- Recebe `mediaUrl` (URL do arquivo no filesystem) e `openaiKey`
- Baixa o arquivo de áudio da URL local (ou lê do filesystem direto via `/media-files/`)
- Envia para `https://api.openai.com/v1/audio/transcriptions` (modelo `whisper-1`)
- Retorna o texto transcrito ou `null` em caso de erro

**2. Alterar o bloco da IA Escuta** (linhas 384-391):
- Expandir a condição para incluir mensagens de áudio com `mediaUrl`
- Se `messageType === "audio"` e `mediaUrl` existe:
  - Buscar `openai_api_key` do perfil do usuário
  - Chamar `transcribeAudio(mediaUrl, openaiKey)`
  - Se obtiver texto, chamar `checkAndAutoListen` com o texto transcrito
- Se for texto normal, manter o fluxo atual

**3. Ajustar `checkAndAutoListen`** (linha 692):
- Adicionar parâmetro opcional `isTranscription: boolean`
- Quando for transcrição, prefixar a mensagem enviada ao modelo com `[Áudio transcrito]:` para dar contexto ao GPT
- O resto do fluxo (criação de lembrete, contexto das últimas 5 mensagens) permanece igual

## Fluxo

```text
Webhook recebe áudio inbound
  → mediaUrl já salva no filesystem
  → Busca openai_api_key do usuário
  → transcribeAudio() → texto
  → checkAndAutoListen(texto, isTranscription=true)
  → GPT analisa → cria lembrete (ou no_action)
```

## Considerações
- A transcrição usa a mesma `openai_api_key` que o usuário já configurou
- Se o usuário não tem chave OpenAI, o áudio é ignorado (mesmo comportamento atual para texto)
- A transcrição é feita lendo o arquivo do filesystem local (`/media-files/userId/file.ogg`), sem necessidade de request HTTP externo
- Custo: Whisper é barato (~$0.006/min de áudio)

