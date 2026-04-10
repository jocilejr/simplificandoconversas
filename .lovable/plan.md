
Objetivo: parar de depender do Storage API da VPS para uploads da Área de Membros e alinhar esse fluxo com a arquitetura que já funciona no projeto.

Diagnóstico
- O problema não está mais nas tabelas de membros nem no bucket em si.
- Pelo código, a tela do erro ainda faz upload direto via Storage API em:
  - `src/components/membros/ContentManagement.tsx`
  - `src/pages/AreaMembros.tsx`
- Já existe um padrão estável na VPS para upload de mídia:
  - `src/components/chatbot/MediaUpload.tsx` chama `whatsapp-proxy`
  - `deploy/backend/src/routes/whatsapp-proxy.ts` salva no filesystem `/media-files/...`
  - `deploy/nginx/default.conf.template` publica isso em `/media/...`
- Ou seja: a Área de Membros está usando um caminho diferente do restante da VPS, e é exatamente esse caminho que está falhando com RLS.

Plano de correção
1. Unificar uploads da Área de Membros com o padrão da VPS
- substituir `supabase.storage.from("member-files").upload(...)` por upload via backend proxy
- usar o mesmo modelo já existente do `MediaUpload`, mas enviando também `workspaceId` para evitar ambiguidade em multi-workspace

2. Corrigir os dois pontos afetados
- `src/components/membros/ContentManagement.tsx`
  - upload da imagem de capa do produto
  - upload de arquivos de material
- `src/pages/AreaMembros.tsx`
  - upload de imagem das ofertas

3. Criar um helper compartilhado no frontend
- centralizar a chamada de upload em uma função utilitária
- entrada: `file`, `workspaceId`
- saída: URL pública em `/media/...`
- isso evita duplicação e reduz novas quebras

4. Manter o restante da lógica intacto
- banco, campos e salvamento continuam iguais
- muda apenas a origem da URL do arquivo enviado

5. Endurecer validações
- preservar limite de tamanho
- preservar `contentType`
- manter mensagens de erro mais claras no toast

Verificações na VPS que vou te pedir depois da implementação
1. Confirmar que o backend está recebendo o upload:
```bash
docker logs deploy-backend-1 --tail=100 | grep -i "media-upload\|whatsapp-proxy"
```

2. Confirmar que o arquivo foi salvo no volume:
```bash
docker exec -i deploy-backend-1 sh -c "ls -R /media-files | tail -n 50"
```

3. Confirmar que a URL pública responde:
```bash
curl -I "https://SEU_API_DOMAIN/media/SEU_USER_ID/ARQUIVO_GERADO.ext"
```

Resultado esperado
- o botão “Selecionar imagem” deixa de depender do Storage API
- uploads da Área de Membros passam a funcionar na VPS
- a URL salva no banco passa a apontar para `/media/...`
- o erro `new row violates row-level security policy` deixa de aparecer nesse fluxo

Detalhe técnico
- Não vou insistir em mais ajustes de RLS para esse caso porque o próprio projeto já adota filesystem + proxy como padrão confiável na VPS.
- O conserto correto aqui é alinhar a Área de Membros com esse padrão existente, não continuar forçando upload direto no Storage API.
