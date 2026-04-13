

## Problema

O backend consulta a tabela `member_area_materials` (que **não existe**) com colunas erradas (`file_url`, `thumbnail_url`). Por isso, nenhum arquivo é classificado como "member" — tudo cai em "temporary".

A tabela correta é `member_product_materials` com coluna `content_url`. Além disso, falta verificar `member_area_offers.image_url`.

## Correção: `deploy/backend/src/routes/media-manager.ts`

Bloco de verificação de membros (linhas 130-138) — trocar:

```typescript
// ERRADO:
const { data: materials } = await sb.from("member_area_materials").select("file_url, thumbnail_url")...

// CORRETO:
const { data: materials } = await sb.from("member_product_materials").select("content_url").eq("workspace_id", workspaceId);
const { data: offers } = await sb.from("member_area_offers").select("image_url").eq("workspace_id", workspaceId);
const memberJson = JSON.stringify(products || []) + JSON.stringify(materials || []) + JSON.stringify(offers || []);
```

Isso fará com que todos os PDFs, imagens e vídeos referenciados nos materiais da área de membros e nas ofertas sejam corretamente identificados como `source: "member"`.

### Arquivo alterado
- `deploy/backend/src/routes/media-manager.ts` — corrigir nome da tabela e colunas no bloco "member"

