
## Remoção completa da Evolution API — Concluído ✅

Todas as referências a "evolution" foram removidas do projeto. O sistema usa exclusivamente Baileys.

### Mudanças realizadas

| Área | Mudança |
|------|---------|
| **Banco de dados** | Tabela `evolution_instances` renomeada para `whatsapp_instances`; colunas `evolution_api_url`, `evolution_api_key`, `evolution_instance_name` removidas de `profiles` |
| **Edge functions** | `evolution-proxy` deletada → `whatsapp-proxy` criada; `evolution-webhook` removida do config.toml |
| **Frontend hooks** | `useWhatsAppInstances`, `useMessages`, `useContactPhoto` atualizados para usar `whatsapp-proxy` e `whatsapp_instances` |
| **Página Conversations** | Invoke atualizado de `evolution-proxy` → `whatsapp-proxy` |
| **Edge function execute-flow** | Query atualizada de `evolution_instances` → `whatsapp_instances` |
| **Deploy backend** | `evolution-proxy.ts` → `whatsapp-proxy.ts`; `webhook.ts` reescrito sem refs Evolution; `execute-flow.ts` atualizado; `index.ts` atualizado |
| **Deploy init-db.sql** | Tabela e colunas renomeadas/removidas |
