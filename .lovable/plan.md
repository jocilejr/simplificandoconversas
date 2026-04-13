

## Plano: Suportar importação de backup de 300MB

### Problema
O arquivo de backup tem 300MB porque inclui mídias em base64 no campo `media`. O frontend tenta carregar tudo na memória com `file.text()` e enviar num único POST, que estoura o limite do Nginx (50MB) e também trava o navegador.

### Solução: Importação em 3 etapas

O frontend lê o JSON via streaming (sem carregar tudo na memória de uma vez), separa dados de mídia, e envia em partes.

### Mudanças

#### 1. Frontend — `GroupCampaignsTab.tsx`
- Trocar `file.text()` + `JSON.parse()` por leitura streaming do arquivo
- Extrair apenas `version`, `data.campaigns`, `data.scheduled_messages` e a lista de chaves de `media` (sem o conteúdo base64) para exibir o resumo no diálogo
- Passar o `File` original para o diálogo em vez do JSON completo parseado

#### 2. Frontend — `GroupImportDialog.tsx`
Importação em 3 etapas com progresso real:

**Etapa 1**: Enviar apenas metadados (campanhas + mensagens, sem mídia) para `POST /groups/import-backup`
- O backend já funciona sem mídia — simplesmente não terá remapeamento de URLs

**Etapa 2**: Para cada mídia do backup, enviar individualmente via `POST /groups/import-media` (FormData com o arquivo binário)
- Ler o JSON novamente mas só extrair o campo `media`, iterando chave por chave
- Converter cada data URI para Blob e enviar como FormData
- Coletar o mapa oldPath→newUrl

**Etapa 3**: Enviar `POST /groups/import-remap-media` com o mapa de URLs para atualizar o conteúdo das mensagens já inseridas

Progresso: barra com porcentagem real (X de Y mídias enviadas)

#### 3. Backend — `groups-api.ts`

**Rota `POST /import-backup`** (modificar):
- Remover processamento de mídia (campo `media` do body)
- Manter apenas criação de campanhas + mensagens
- Retornar também o `campaignIdMap` e lista de `messageIds` inseridos para o remapeamento posterior

**Nova rota `POST /import-media`**:
- Recebe FormData: `file` (binário), `path` (string original), `workspaceId`, `userId`
- Faz upload ao volume via whatsapp-proxy (media-upload action) ou direto ao filesystem
- Retorna `{ oldPath, newUrl }`

**Nova rota `POST /import-remap-media`**:
- Recebe `{ workspaceId, messageIds: string[], mediaUrlMap: Record<string, string> }`
- Busca cada mensagem pelo ID, faz string replace no `content` JSONB, e atualiza

#### 4. Nginx — `default.conf.template`
- No bloco do API_DOMAIN `/functions/v1/`, já tem `client_max_body_size 50M` herdado do server. Isso é suficiente pois agora cada request individual será pequeno (uma mídia por vez, max ~20MB)

### Arquivos

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/groups-api.ts` | Separar import-backup (sem media), nova rota import-media, nova rota import-remap-media |
| `src/components/grupos/GroupCampaignsTab.tsx` | Leitura streaming do arquivo, passar File ao diálogo |
| `src/components/grupos/GroupImportDialog.tsx` | Importação em 3 etapas com progresso real |

### Fluxo

```text
Usuário seleciona arquivo .json (300MB)
  │
  ├─ Frontend lê parcialmente → extrai resumo (campanhas, msgs, nº mídias)
  ├─ Mostra diálogo de confirmação
  │
  └─ Usuário clica "Importar"
      │
      ├─ Etapa 1: POST /import-backup (só data, ~1MB) → campanhas + msgs criadas
      │   └─ Retorna messageIds + campaignIdMap
      │
      ├─ Etapa 2: Para cada mídia (1 por vez):
      │   POST /import-media (FormData, ~5MB cada)
      │   └─ Retorna { oldPath, newUrl }
      │   └─ Progresso: "Enviando mídia 3 de 47..."
      │
      └─ Etapa 3: POST /import-remap-media
          └─ Atualiza URLs no content das mensagens
```

