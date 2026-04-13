

## Plano: Corrigir `iterateMediaEntries` para leitura incremental real

### Problema raiz
A função `iterateMediaEntries()` em `src/lib/backupParser.ts` (linha 276) faz `const text = await file.text()`, carregando os 300MB inteiros na memória do navegador. Isso trava a aba e impede a importação.

O resto do sistema está correto:
- Nginx tem `client_max_body_size 100M` na rota `/import-media`
- Backend aceita multipart/form-data
- `parseBackupSummary()` já lê só os primeiros 10MB (funciona)
- Frontend envia mídias uma a uma via FormData (funciona)

### Correção

Reescrever `iterateMediaEntries()` em `src/lib/backupParser.ts` para ler o arquivo em chunks de 2MB, extraindo pares chave-valor da seção `media` sem carregar tudo na memória.

A lógica:
1. Localizar a posição de `"media": {` no arquivo usando leitura em chunks
2. A partir dessa posição, ler chunk por chunk
3. Para cada par chave-valor (path + data URI), acumular os bytes necessários e fazer yield
4. Após o yield, descartar os dados da memória antes de ler o próximo par

Isso garante que apenas uma mídia por vez está na memória.

### Detalhe técnico

O desafio é que os valores base64 podem ter vários MB cada. O parser precisa:
- Manter um buffer de texto parcial entre chunks
- Detectar limites de strings JSON (`"..."`) corretamente, respeitando escapes
- Extrair a chave (path curto, poucos bytes) e o valor (data URI grande) separadamente
- Fazer yield e liberar o valor antes de continuar

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/lib/backupParser.ts` | Reescrever `iterateMediaEntries()` para leitura em chunks sem `file.text()` |

Nenhuma mudança necessária no backend, nginx ou dialog — só o parser.

