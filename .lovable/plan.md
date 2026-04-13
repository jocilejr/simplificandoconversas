

## Plano: Gerenciador de arquivos de mídia nas Configurações

### Resumo

Criar uma nova aba "Arquivos" nas Configurações que lista todos os arquivos de mídia do volume `/media-files/{userId}/`, permitindo visualizar preview, selecionar e deletar arquivos. A aba separa visualmente arquivos permanentes (raiz) de temporários (`tmp/`).

### Arquivos a criar/alterar

#### 1. Backend — Nova rota `deploy/backend/src/routes/media-manager.ts`

API REST para gerenciar arquivos no filesystem:

- **`GET /api/media-manager/list`** — Lista todos os arquivos do `userId` com metadata (nome, tamanho, data de criação, path relativo, tipo MIME, se está em `tmp/` ou raiz). Retorna JSON com array de arquivos.
- **`DELETE /api/media-manager/delete`** — Recebe array de filenames e deleta do filesystem. Aceita `{ files: ["uuid.ogg", "tmp/uuid.mp3"] }`.
- Autenticação via header `x-user-id` + `x-workspace-id` (mesmo padrão das rotas existentes como `whatsapp-proxy`).

#### 2. Backend — Registrar rota em `deploy/backend/src/index.ts`

Adicionar `import mediaManagerRouter` e `app.use("/api/media-manager", mediaManagerRouter)`.

#### 3. Frontend — Novo componente `src/components/settings/MediaManagerSection.tsx`

- Tabela com colunas: Preview (thumbnail/ícone), Nome, Tipo, Tamanho, Data, Localização (permanente/temporário)
- Checkbox para seleção múltipla + botão "Deletar selecionados"
- Preview inline: imagens mostram thumbnail, áudios mostram player, PDFs mostram ícone com link
- Filtros por tipo (áudio, imagem, vídeo, PDF, todos) e localização (permanente/temporário)
- Indicador visual de quais arquivos estão referenciados no banco (fluxos/campanhas) com badge "Em uso"
- Confirmação antes de deletar

#### 4. Frontend — Atualizar `src/pages/SettingsPage.tsx`

Adicionar seção `{ key: "media", label: "Arquivos", icon: HardDrive, minRole: "admin" }` e o case correspondente no `renderContent`.

#### 5. Nginx — Já configurado

A rota `/media/` já serve os arquivos estáticos. O proxy `/functions/v1/` já redireciona para o backend. Nenhuma mudança necessária.

### Fluxo de dados

```text
Frontend (MediaManagerSection)
  → GET /functions/v1/media-manager/list
  → Backend lê /media-files/{userId}/ recursivamente
  → Retorna lista com metadata
  
Frontend (botão deletar)
  → DELETE /functions/v1/media-manager/delete
  → Backend remove arquivos do filesystem
  → Frontend atualiza lista
```

### Detalhes técnicos

- O backend usa `fs.readdir` recursivo para listar arquivos, ignorando subdiretórios que não sejam `tmp/`
- Preview de imagens usa a URL pública existente (`/media/{userId}/{filename}`)
- Para verificar se um arquivo está "em uso", o backend consulta `chatbot_flows.nodes`, `group_scheduled_messages.content` e `boleto_recovery_rules.media_blocks` buscando o filename
- Arquivos em `tmp/` recebem badge "Temporário" e os da raiz recebem "Permanente"

