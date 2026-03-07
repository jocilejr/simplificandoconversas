

## Remover completamente "Evolution" do app

O plano renomeia toda referência a "evolution" para "whatsapp" em todo o codebase. São ~15 arquivos afetados.

### 1. Migração de banco (Lovable Cloud)

```sql
-- Renomear tabela
ALTER TABLE public.evolution_instances RENAME TO whatsapp_instances;

-- Remover colunas legacy do profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_api_url;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_api_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_instance_name;
```

### 2. Edge function: deletar e recriar

- **Deletar** `supabase/functions/evolution-proxy/index.ts`
- **Criar** `supabase/functions/whatsapp-proxy/index.ts` (mesmo stub, mensagem atualizada)
- **Atualizar** `supabase/config.toml`: trocar `evolution-proxy` → `whatsapp-proxy`, remover `evolution-webhook`

### 3. Frontend — hooks e páginas (4 arquivos)

| Arquivo | Mudança |
|---|---|
| `src/hooks/useWhatsAppInstances.ts` | `.from("evolution_instances")` → `.from("whatsapp_instances")`, `invoke("evolution-proxy")` → `invoke("whatsapp-proxy")` |
| `src/hooks/useMessages.ts` | `invoke("evolution-proxy")` → `invoke("whatsapp-proxy")` |
| `src/hooks/useContactPhoto.ts` | `invoke("evolution-proxy")` → `invoke("whatsapp-proxy")`, remover comentário "Evolution API" |
| `src/pages/Conversations.tsx` | `invoke("evolution-proxy")` → `invoke("whatsapp-proxy")` |

### 4. Edge function execute-flow

- `supabase/functions/execute-flow/index.ts` linha 334: `.from("evolution_instances")` → `.from("whatsapp_instances")`

### 5. Deploy backend (4 arquivos)

| Arquivo | Mudança |
|---|---|
| `deploy/backend/src/routes/evolution-proxy.ts` | Renomear para `whatsapp-proxy.ts`, trocar todas as refs `evolution_instances` → `whatsapp_instances`, variável `evolution_instance_name` → `instanceName` |
| `deploy/backend/src/index.ts` | Import e rotas: `evolution-proxy` → `whatsapp-proxy`, `evolution-webhook` → `webhook` |
| `deploy/backend/src/routes/webhook.ts` | `.from("evolution_instances")` → `.from("whatsapp_instances")`, remover lookup por `evolution_instance_name` no profiles, remover download de mídia via Evolution API (usar Baileys direto) |
| `deploy/backend/src/routes/execute-flow.ts` | Trocar `evolution_instance_name` → `instanceName`, `.from("evolution_instances")` → `.from("whatsapp_instances")`, remover select de colunas evolution do profiles |

### 6. Deploy init-db.sql

- Renomear tabela `evolution_instances` → `whatsapp_instances`
- Remover colunas `evolution_*` do profiles

### Resultado

Zero referências a "evolution" em todo o projeto. O sistema usa exclusivamente Baileys via `whatsapp-proxy`.

