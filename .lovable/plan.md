

## Exportar e Importar Fluxos com Mídias

### Visão Geral
Adicionar botões de **Exportar** e **Importar** fluxo no editor e na listagem de fluxos. O arquivo exportado será um `.json` completo contendo nodes, edges, configurações e todas as mídias embutidas em base64.

### Formato do Arquivo de Exportação

```text
{
  "version": 1,
  "exportedAt": "2026-03-30T...",
  "name": "Meu Fluxo",
  "instanceNames": ["..."],
  "nodes": [...],
  "edges": [...],
  "media": {
    "https://api.../media/.../file.png": "data:image/png;base64,iVBOR...",
    "https://api.../media/.../audio.mp3": "data:audio/mpeg;base64,SUQz..."
  }
}
```

### Lógica de Exportação
1. Percorrer todos os nodes (incluindo steps dentro de groupBlocks)
2. Coletar todas as URLs de mídia dos campos: `audioUrl`, `mediaUrl`, `fileUrl`, `clickPreviewImage`
3. Para cada URL, fazer `fetch()` e converter para base64 (`data:mimetype;base64,...`)
4. Salvar o JSON com nodes, edges, instance_names e o mapa de mídias
5. Disparar download do arquivo `.json`

### Lógica de Importação
1. Usuário seleciona arquivo `.json`
2. Validar estrutura (version, nodes, edges)
3. Para cada entrada no mapa `media`:
   - Fazer upload via `supabase.functions.invoke("whatsapp-proxy", { action: "media-upload" })` (endpoint existente)
   - Obter nova URL
4. Substituir todas as URLs antigas pelas novas nos nodes
5. Criar novo fluxo via `createFlow` + `updateFlow` com os dados importados
6. Abrir o fluxo importado no editor

### Onde ficam os botões

1. **Na listagem (`ChatbotBuilder.tsx`)**: 
   - Dropdown menu de cada card do fluxo: adicionar "Exportar"
   - Botão "Importar Fluxo" ao lado de "Novo Fluxo" no header

2. **No editor (`FlowEditor.tsx`)**: 
   - Botão "Exportar" no painel top-right, ao lado de "Salvar"

### Implementação

1. **Criar `src/lib/flowExportImport.ts`** -- Funções utilitárias:
   - `extractMediaUrls(nodes)` -- percorre nodes e steps, coleta URLs
   - `exportFlow(flow)` -- busca mídias, monta JSON, dispara download
   - `importFlow(file, createFn, updateFn)` -- lê JSON, re-uploada mídias, cria fluxo

2. **Editar `src/pages/ChatbotBuilder.tsx`** -- Adicionar botão "Importar" no header e "Exportar" no dropdown de cada card

3. **Editar `src/components/chatbot/FlowEditor.tsx`** -- Adicionar botão "Exportar" no top-right panel

### Tratamento de Erros
- Progresso visual durante export/import (toast com loading)
- Se uma mídia falhar no fetch, incluir URL original sem base64 e avisar
- Validação do formato do arquivo na importação

