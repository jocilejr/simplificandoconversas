

## Plano: Limpar mídias do storage ao excluir campanha

### Problema
Quando uma campanha é excluída, apenas a linha do `group_campaigns` (e as `group_scheduled_messages` via CASCADE) são removidas do banco. Os arquivos de mídia que foram enviados ao bucket `chatbot-media` ficam acumulando lixo no storage indefinidamente.

### Solução
Alterar a rota `DELETE /campaigns/:id` no backend (`deploy/backend/src/routes/groups-api.ts`) para:

1. **Antes de deletar a campanha**, buscar todas as `group_scheduled_messages` da campanha
2. Para cada mensagem do tipo mídia (`image`, `video`, `audio`, `document`), extrair a URL do storage do campo `content`
3. Converter a URL pública de volta para o path do storage (extraindo a parte após `/chatbot-media/`)
4. Chamar `sb.storage.from("chatbot-media").remove([...paths])` para apagar os arquivos
5. Só então deletar a campanha do banco

### Arquivo alterado

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/groups-api.ts` | Expandir rota `DELETE /campaigns/:id` (linhas 449-458) para limpar mídias do storage antes de deletar |

### Detalhe técnico
A lógica de extração do path será:
```text
URL: https://...storage.../chatbot-media/userId/import-xxx.png
Path no bucket: userId/import-xxx.png
```

Mensagens de tipo `text` serão ignoradas (não têm mídia). A limpeza será best-effort — se algum arquivo falhar ao ser removido, a exclusão da campanha continua normalmente (só loga o erro).

