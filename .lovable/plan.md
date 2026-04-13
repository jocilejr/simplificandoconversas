

## Plano: Importar backup do whats-grupos no sistema de Grupos

### Contexto

O sistema externo (whats-grupos) exporta um arquivo JSON com a seguinte estrutura:
```text
{
  version: 1,
  data: {
    campaigns: [{ name, description, group_ids, instance_name, is_active, ... }],
    scheduled_messages: [{ campaign_id, content, schedule_type, message_type, scheduled_at, cron_expression, is_active, ... }],
    message_templates: [...],
    api_configs: [...],
    ...
  },
  media: { "path": "data:mime;base64,..." }
}
```

O mapeamento para o seu sistema:
- `campaigns` → `group_campaigns` (group_ids → group_jids)
- `scheduled_messages` → `group_scheduled_messages` (vinculadas às campanhas importadas)
- Mídias referenciadas nos `content` são enviadas ao storage e URLs remapeadas

### Mudanças

#### 1. Backend — Nova rota `POST /groups/import-backup` (`groups-api.ts`)

Recebe o JSON do backup + workspaceId + userId. Processa:
1. Para cada `campaign` do backup, cria um registro em `group_campaigns` com o mapeamento de campos
2. Mapeia IDs antigos → novos para vincular as mensagens
3. Para cada `scheduled_message`, cria em `group_scheduled_messages` vinculada à campanha importada, recalculando `next_run_at`
4. Se houver mídia no backup, faz upload ao bucket `chatbot-media` e remapeia URLs dentro dos `content`
5. Retorna resumo (campanhas importadas, mensagens importadas)

O `instance_name` das campanhas é preservado como texto — se não existir uma instância correspondente no workspace, a campanha é criada como inativa.

#### 2. Frontend — Botão "Importar" na aba Campanhas (`GroupCampaignsTab.tsx`)

Adicionar botão "Importar" ao lado de "Nova Campanha" que:
1. Abre um file input para selecionar o `.json`
2. Valida a estrutura do arquivo (version === 1, arrays esperados)
3. Mostra diálogo de confirmação com resumo (X campanhas, Y mensagens)
4. Envia para a rota de importação
5. Atualiza a lista de campanhas após importação

#### 3. Frontend — Diálogo de confirmação (`GroupImportDialog.tsx`)

Modal que exibe:
- Resumo do arquivo (quantas campanhas, mensagens, mídias)
- Progresso durante importação
- Resultado final com contadores de sucesso/erro

### Arquivos

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/groups-api.ts` | Nova rota POST `/import-backup` |
| `src/components/grupos/GroupCampaignsTab.tsx` | Botão Importar + file input |
| `src/components/grupos/GroupImportDialog.tsx` | Novo diálogo de confirmação e progresso |

