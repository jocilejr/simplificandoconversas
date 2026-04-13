
## Plano: corrigir a falha persistente na importação de mídias

### Diagnóstico atual
O fluxo de importação de campanhas/mensagens está funcionando, mas as mídias falham antes de completar o upload.

A evidência no código aponta para o frontend:
- `src/components/grupos/GroupImportDialog.tsx` captura a falha por mídia e só incrementa `mediaFailed`
- `deploy/backend/src/routes/groups-api.ts` só loga algo quando `/import-media` realmente é atingido
- o conversor atual `dataUriToFile()` em `src/lib/backupParser.ts` aceita apenas este formato rígido:
```text
data:<mime>;base64,<payload>
```
Se o backup vier com `charset`, `name`, quebras de linha, base64 “cru” ou outra variação, ele falha no navegador antes do `fetch`

### O que vou implementar
1. **Tornar o parser de mídia resiliente**
   - Reescrever `dataUriToFile()` em `src/lib/backupParser.ts`
   - Aceitar variações como:
     - `data:image/png;charset=utf-8;base64,...`
     - `data:application/pdf;name=file.pdf;base64,...`
     - base64 sem prefixo `data:`
   - Remover whitespace/quebras de linha do base64 antes de decodificar
   - Usar fallback de MIME pelo caminho/extensão quando necessário
   - Retornar erros mais úteis, em vez de `Invalid data URI` genérico

2. **Mostrar o motivo real da falha no diálogo**
   - Atualizar `src/components/grupos/GroupImportDialog.tsx`
   - Guardar os erros das mídias individualmente
   - Exibir no resultado final pelo menos os primeiros erros reais
   - Quando o backend responder erro, mostrar `status + texto da resposta`

3. **Adicionar rastreio mínimo no backend para validação na VPS**
   - Ajustar `deploy/backend/src/routes/groups-api.ts`
   - Logar no início da rota `/import-media` que a requisição chegou
   - Logar falhas de parsing multipart com contexto suficiente para depuração
   - Isso permite confirmar pela VPS se o problema ainda está no frontend ou já está chegando no servidor

### Arquivos
| Arquivo | Ação |
|---|---|
| `src/lib/backupParser.ts` | Robustecer conversão de data URI/base64 para `File` |
| `src/components/grupos/GroupImportDialog.tsx` | Exibir erros detalhados por mídia |
| `deploy/backend/src/routes/groups-api.ts` | Adicionar logs de entrada/erro em `/import-media` |

### Verificação na VPS depois da implementação
Como você usa só a VPS, a validação precisa ser feita aí:

```bash
cd ~/simplificandoconversas
git pull origin main
bun install && bun run build
rm -rf deploy/frontend/*
cp -r dist/* deploy/frontend/
cd deploy
docker compose up -d backend --build
docker compose restart nginx
```

#### Confirmar que o frontend novo foi publicado
Vou deixar uma string de erro nova fácil de procurar no bundle. Depois rode:
```bash
docker exec -it $(docker ps --filter name=nginx -q | head -n1) sh -lc 'grep -R "Formato de mídia não reconhecido" /usr/share/nginx/html || true'
```

#### Confirmar chegada das requisições no backend
Antes de testar a importação:
```bash
cd ~/simplificandoconversas/deploy
docker compose logs -f backend | grep -Ei "import-media|media upload|multipart"
```

### Resultado esperado
Depois dessa correção, vai acontecer um destes dois cenários:
1. **As mídias passam a subir normalmente**, porque o formato do backup era incompatível com o parser rígido atual
2. **A UI passa a mostrar exatamente por que cada mídia falhou**, e os logs da VPS dirão se a rota `/import-media` está sendo chamada ou não

### Observação técnica
Não há necessidade de alterar banco, storage bucket ou nginx para esta correção. O problema mais provável está no tratamento do conteúdo da mídia no frontend e na falta de visibilidade do erro real.
