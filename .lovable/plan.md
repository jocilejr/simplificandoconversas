
Objetivo

Corrigir de verdade a importação de backup grande na aba de Grupos, porque hoje o fluxo ainda quebra com 413 e ainda carrega o arquivo inteiro na memória do navegador.

Problema atual identificado no código

- `src/components/grupos/GroupCampaignsTab.tsx` ainda faz `await file.text()` + `JSON.parse(fullText)` para ler o resumo. Isso continua carregando os 300MB no browser.
- `src/components/grupos/GroupImportDialog.tsx` faz `await file.text()` de novo para ler a seção `media`. Ou seja: segunda leitura inteira do arquivo.
- `deploy/backend/src/routes/groups-api.ts` em `/import-media` ainda recebe `{ dataUri }` em JSON. Isso continua mandando base64 pelo corpo da requisição.
- `deploy/backend/src/index.ts` usa `express.json({ limit: "50mb" })`.
- `deploy/nginx/default.conf.template` também está com `client_max_body_size 50M`.

Conclusão: o plano anterior foi só parcialmente aplicado. O gargalo principal continua existindo.

Plano de implementação

1. Criar um parser incremental do backup no frontend
- Adicionar um helper dedicado para ler o `File` em stream e parsear o JSON por partes.
- Esse helper vai:
  - extrair `version`
  - coletar `data.campaigns`
  - coletar `data.scheduled_messages`
  - iterar `media` sem precisar fazer `file.text()`
- O resumo da importação vai mostrar apenas contagens, sem manter o JSON inteiro no estado do React.

2. Corrigir `GroupCampaignsTab.tsx`
- Remover a leitura completa do arquivo.
- Trocar por leitura incremental só para validar a estrutura e montar o resumo.
- Manter apenas o `File` original + resumo leve no estado.

3. Corrigir `GroupImportDialog.tsx`
- Na etapa 1, enviar somente campanhas + mensagens, sem `media`.
- Na etapa 2, iterar as mídias do backup uma a uma usando o parser incremental.
- Converter cada item de mídia para `Blob/File` no navegador.
- Enviar cada mídia em `FormData`, não mais em JSON com `dataUri`.
- Na etapa 3, chamar o remapeamento final das URLs nas mensagens.
- Melhorar a UI de progresso para deixar claro em qual etapa está e quantas mídias faltam.

4. Corrigir backend de importação
- Alterar `/groups/import-media` para receber `multipart/form-data`.
- Salvar a mídia no bucket `chatbot-media` e retornar `{ oldPath, newUrl }`.
- Manter `/import-backup` apenas para dados estruturais.
- Manter `/import-remap-media` para atualizar o `content` das mensagens.
- Se necessário, fazer o remapeamento em lotes para evitar payload grande quando houver muitas mídias.

5. Ajustar a VPS apenas onde faz sentido
- Não resolver só “aumentando limite”.
- Subir o limite apenas para a rota de upload de mídia, porque ela vai receber arquivo binário individual.
- Manter o restante da API mais restrito.

Arquivos que vou alterar

- `src/components/grupos/GroupCampaignsTab.tsx`
- `src/components/grupos/GroupImportDialog.tsx`
- `src/lib/...` novo helper de parser incremental do backup
- `deploy/backend/src/routes/groups-api.ts`
- `deploy/backend/package.json`
- `deploy/nginx/default.conf.template`

Detalhes técnicos

- Vou trocar o envio de mídia de JSON/base64 para binário via `FormData`.
- Vou adicionar um parser streaming no frontend, porque hoje o maior problema é o `file.text()` em dois pontos.
- O limite de `express.json` pode continuar em 50MB para JSON normal, porque upload de mídia não deve mais passar por esse parser.
- No Nginx, o ajuste ideal é específico para `/functions/v1/groups/import-media`, não global para tudo.
- Se existir alguma mídia individual acima do novo limite por requisição, eu também vou deixar tratamento explícito para falha amigável em vez de erro genérico 413.

Validação na sua VPS

Quero validar isso pela VPS, não pelo ambiente hospedado. Depois da implementação, a checagem ideal é esta:

```bash
docker compose logs -f nginx | grep -Ei "413|too large|client intended to send too large body"
```

```bash
docker compose logs -f backend | grep -Ei "import-backup|import-media|import-remap-media"
```

```bash
docker exec -it $(docker ps --filter name=nginx -q | head -n1) nginx -T | grep -n "client_max_body_size"
```

Critério de sucesso

- selecionar backup de 300MB sem travar o navegador
- resumo abrir sem ler o arquivo inteiro em memória
- `import-backup` responder rápido com campanhas + mensagens
- mídias subirem uma a uma sem 413
- remapeamento final atualizar os conteúdos corretamente
- campanhas importadas aparecerem na aba de grupos no final
