

## Problema

O gerenciador de mídia só escaneia `/media-files/<userId-logado>`. Mas num workspace multi-tenant, arquivos são enviados por diferentes usuários. Capas de produtos e materiais de membros podem estar em `/media-files/<outro-userId>`, e por isso não aparecem.

O cleanup também opera apenas sobre a pasta do usuário logado, não cobrindo todo o workspace.

## Solução: Scan workspace-aware

### Backend: `deploy/backend/src/routes/media-manager.ts`

**1. Nova função `getWorkspaceUserIds(workspaceId)`**
- Query `workspace_members` filtrando pelo `workspace_id`
- Retorna array de `user_id` de todos os membros

**2. Nova função `scanWorkspaceFiles(userIds)`**
- Itera sobre cada `userId` do workspace
- Chama `scanUserFiles(userId)` para cada um
- Concatena todos os resultados, incluindo o `ownerUserId` em cada `ScannedFile`

**3. Adicionar campo `ownerUserId` ao `ScannedFile`**
- Para que delete/cleanup saibam em qual pasta física o arquivo está

**4. Atualizar endpoint `GET /list`**
- Substituir `scanUserFiles(userId)` por `scanWorkspaceFiles(allUserIds)`
- O `computeSourceMap` já recebe `workspaceId`, então funciona sem mudança

**5. Atualizar endpoint `DELETE /delete`**
- O body agora precisa receber `ownerUserId` + `relativePath` (ou o path completo incluindo o userId)
- Validar que o `ownerUserId` pertence ao workspace do usuário logado

**6. Atualizar endpoint `DELETE /cleanup`**
- Substituir `scanUserFiles(userId)` por `scanWorkspaceFiles(allUserIds)`
- A lógica de proteção (flow/member/group) continua igual
- Deleta temporários de TODOS os membros do workspace, não só do logado

### Frontend: `src/components/settings/MediaManagerSection.tsx`

**7. Adaptar `handleDelete`**
- Enviar `ownerUserId` junto com cada arquivo no request de delete
- Ou enviar o `url` completo e deixar o backend extrair o userId do path

### Resultado
- Ao abrir o gerenciador: lista TODOS os arquivos de TODOS os membros do workspace
- Limpeza: remove temporários de todo o workspace, não de toda a VPS
- Classificação: continua igual, baseada em referências do banco

### Arquivos alterados
- `deploy/backend/src/routes/media-manager.ts`
- `src/components/settings/MediaManagerSection.tsx`

