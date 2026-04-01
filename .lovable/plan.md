

# Diagnóstico: PDF sem preview e sem nome personalizado

## Análise do código

O envio de PDF no `execute-flow.ts` (linha 134) envia para a Evolution API:

```json
{
  "number": "...",
  "mediatype": "document",
  "media": "URL_DO_ARQUIVO",
  "fileName": "documento.pdf",
  "mimetype": "application/pdf"
}
```

### Problema 1: Nome do arquivo

O código usa `(stepData as any).fileName || "documento.pdf"`. Se o campo `fileName` estiver vazio ou undefined nos dados do fluxo, cai no fallback "documento.pdf".

Além disso, no `PropertiesPanel.tsx` (linha 108), ao fazer upload, o sistema já define `fileName: d.fileName || "documento.pdf"` — se o nome ainda não foi digitado, o valor "documento.pdf" é salvo automaticamente e pode ter ficado assim.

**Diagnóstico na VPS**: Verificar o que está salvo no banco de dados:

```bash
docker exec deploy-db-1 psql -U postgres -d chatbot -c "
  SELECT id, name,
    jsonb_pretty(
      (SELECT jsonb_agg(n->'data') FROM jsonb_array_elements(nodes::jsonb) n WHERE n->'data'->>'type' = 'sendFile')
    ) as send_file_nodes
  FROM chatbot_flows
  WHERE nodes::text LIKE '%sendFile%'
  LIMIT 5;
"
```

Isso mostrará os dados reais salvos para cada nó sendFile — especialmente se `fileName` está presente ou vazio.

### Problema 2: Preview (miniatura)

A Evolution API para `mediatype: "document"` **não gera miniatura/preview** no WhatsApp. Isso é uma limitação do próprio WhatsApp — documentos PDF aparecem apenas com o ícone genérico de PDF. Apenas imagens e vídeos mostram preview.

Para que o PDF mostre com preview no WhatsApp, seria necessário enviá-lo como **imagem** (uma captura da capa) seguida do documento, ou não há como forçar isso via API.

## Plano de correção

### 1. Garantir que `fileName` é salvo corretamente (frontend)

**Arquivo**: `src/components/chatbot/PropertiesPanel.tsx`

- Ao fazer upload, NÃO definir um fileName padrão automaticamente — deixar o campo vazio para o usuário preencher
- Só aplicar o fallback "documento.pdf" no momento do envio (backend), não no salvamento

### 2. Adicionar `caption` ao envio de documento (backend)

**Arquivo**: `deploy/backend/src/routes/execute-flow.ts`

- Adicionar o campo `caption` (que já existe para imagem/vídeo) ao payload do sendFile
- Usar o `fileName` (sem extensão) como caption, para que apareça como texto descritivo no WhatsApp

### 3. Adicionar log de debug para o fileName

**Arquivo**: `deploy/backend/src/routes/execute-flow.ts`

- Logar o `fileName` que está sendo enviado para facilitar debug futuro

### Resultado

- O nome personalizado definido no editor será preservado corretamente
- O documento será enviado com caption descritivo
- A miniatura/preview continua sendo uma limitação do WhatsApp para documentos (não há solução via API)

