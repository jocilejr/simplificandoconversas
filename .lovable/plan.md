

## Plano: Smart Link como Subsecção Independente

### Conceito

O Smart Link deixa de estar atrelado a campanhas e passa a ser uma **aba própria** dentro da página de Grupos. O fluxo será:

1. Selecionar a instância WhatsApp
2. Selecionar os grupos desejados (similar ao GroupSelectorTab)
3. Definir slug e limite de membros
4. Ao salvar, o sistema sincroniza automaticamente os invite codes e mostra em tempo real: membros atuais de cada grupo, qual grupo está recebendo leads, e cliques totais

### Mudanças

#### 1. Página de Grupos — nova aba "Smart Link"
**`src/pages/GruposPage.tsx`** — Adicionar aba `smart-link` com ícone Link2.

#### 2. Novo componente `GroupSmartLinkTab.tsx`
**`src/components/grupos/GroupSmartLinkTab.tsx`** — Componente completo com:

- **Se não tem smart link criado**: formulário de criação
  - Select de instância (reutiliza `useWhatsAppInstances`)
  - Botão "Buscar Grupos" → lista grupos com checkbox (reutiliza lógica do GroupSelectorTab)
  - Campo slug + campo max membros/grupo
  - Botão "Criar Smart Link"

- **Se já tem smart link**: dashboard ao vivo
  - URL pública com botão copiar
  - Cards de estatísticas: cliques totais, grupos vinculados
  - **Tabela de grupos** mostrando em cada linha:
    - Nome do grupo
    - Membros atuais (com badge vermelho se lotado)
    - Invite URL (check/x)
    - Cliques recebidos
    - Indicador visual "► Ativo" no grupo que está recebendo leads (o com menos membros abaixo do limite)
  - Botões: Sincronizar URLs, Editar (slug/limite), Excluir

#### 3. Refatorar hook `useGroupSmartLinks.ts`
**`src/hooks/useGroupSmartLinks.ts`** — Remover dependência de `campaignId`:
- Query busca por `workspaceId` apenas (sem filtro de campanha)
- `createSmartLink` aceita `groupJids` + `instanceName` direto (sem campaignId)
- Manter CRUD, sync e stats

#### 4. Backend — desacoplar de campanha
**`deploy/backend/src/routes/groups-api.ts`**:
- `POST /smart-links`: aceitar `groupJids` e `instanceName` direto no body (sem depender de campaignId)
- `POST /smart-links/sync-invite`: usar `instanceName` salvo no smart link (sem buscar via campaign)
- Adicionar campo `instance_name` no insert/update do smart link
- Redirect e stats permanecem iguais

#### 5. Migração SQL
Adicionar coluna `instance_name` à tabela `group_smart_links`:
```sql
ALTER TABLE group_smart_links ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE group_smart_links ALTER COLUMN campaign_id DROP NOT NULL;
```

#### 6. Remover integração antiga
- **`src/components/grupos/GroupCampaignsTab.tsx`**: Remover botão "Smart Link" dos cards de campanha
- **`src/components/grupos/GroupSmartLinkDialog.tsx`**: Deletar (substituído pelo Tab)

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL (add `instance_name`) | Criar |
| `src/components/grupos/GroupSmartLinkTab.tsx` | Criar |
| `src/pages/GruposPage.tsx` | Alterar (nova aba) |
| `src/hooks/useGroupSmartLinks.ts` | Refatorar |
| `deploy/backend/src/routes/groups-api.ts` | Alterar (desacoplar) |
| `src/components/grupos/GroupCampaignsTab.tsx` | Alterar (remover botão) |
| `src/components/grupos/GroupSmartLinkDialog.tsx` | Deletar |

