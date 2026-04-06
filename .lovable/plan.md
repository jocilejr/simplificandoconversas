
Objetivo

Parar de retornar vazio e separar corretamente:
- e-mail
- tags
- timestamp

sem depender da IA para decidir isso na VPS.

Diagnóstico provável

O comportamento “0 válidos / 0 corrigidos / 0 ignorados” indica que o backend está devolvendo `contacts: []`.
No código atual isso acontece quando o parser não consegue eleger uma coluna de e-mail (`emailCol === -1`).

Os pontos mais frágeis hoje são:
- `detectDelimiter()` usa `split()` simples, enquanto o parser real usa `parseCSVLine()`; isso pode escolher o delimitador errado
- `hasHeaderRow()` também usa divisão simplificada
- se a detecção falha, o backend retorna vazio em vez de mostrar linhas inválidas ou um motivo claro
- a VPS ainda pode estar em `auto`, então o comportamento fica menos previsível

Plano de correção

1. Tornar o importador 100% heurístico na VPS
- definir `CSV_ANALYZER_MODE=heuristic` no `deploy/docker-compose.yml`
- remover a IA da decisão principal para esse fluxo
- manter IA apenas como opcional futura, não como caminho usado agora

2. Unificar a leitura do CSV
- refatorar `detectDelimiter()` e `hasHeaderRow()` para usar a mesma lógica de `parseCSVLine()`
- normalizar antes do parse:
  - remover BOM
  - ignorar linha `sep=,` / `sep=;`
  - remover linhas vazias
  - aparar aspas e espaços extras

3. Melhorar a eleição da coluna de e-mail
- escolher a coluna com maior taxa de valores `email-like`, mas com fallback mais robusto
- se nenhuma coluna passar no threshold, fazer fallback por linha:
  - procurar o único token com `@`
  - tratar os demais tokens como tag/timestamp conforme a classificação
- isso evita voltar `[]` em CSVs simples como:
```text
rosefujita2019@gmail.com,etapa4,2025-09-09 02:35:32.632
```

4. Separar tags e timestamp por regra fixa
- `timestamp` nunca entra em `tags`
- `etapa4`, `lead`, `grupo_x`, `campanha_y` entram como tag
- nome só entra se realmente parecer nome humano
- se não houver nome confiável, salvar `name = null`

5. Parar de falhar em silêncio
- quando não houver coluna de e-mail clara, retornar diagnóstico útil em vez de lista vazia “muda”
- backend pode responder com metadados de debug, por exemplo:
  - delimitador detectado
  - se havia header
  - tipos de colunas
  - motivo do fallback
- o frontend pode exibir toast/mensagem como “Nenhuma coluna de e-mail foi reconhecida”

Arquivos a ajustar

- `deploy/backend/src/routes/analyze-csv-contacts.ts`
  - unificar parsing
  - normalizar entrada
  - reforçar detecção de e-mail
  - adicionar fallback por linha
  - impedir retorno vazio sem explicação
  - ignorar timestamp nas tags

- `deploy/docker-compose.yml`
  - definir `CSV_ANALYZER_MODE=heuristic`

- `src/hooks/useEmailContacts.ts`
  - tratar melhor resposta vazia com mensagem mais clara ao usuário

- `src/components/email/EmailContactsTab.tsx`
  - opcional: trocar o texto “Analisando CSV com IA...” por algo neutro como “Analisando CSV...”

Resultado esperado

Para linhas como:
```text
rosefujita2019@gmail.com,etapa4,2025-09-09 02:35:32.632
```

o sistema deve produzir:
```text
email = rosefujita2019@gmail.com
name = null
tags = ["etapa4"]
timestamp = ignorado
status = valid
```

Validação dentro da VPS

Depois da correção, a checagem deve ser feita na VPS com:

```bash
cd /root/simplificandoconversas/deploy
docker compose exec -T backend sh -lc 'echo CSV_ANALYZER_MODE=${CSV_ANALYZER_MODE:-auto}'
docker compose logs backend --tail=200 | grep analyze-csv
```

Se ainda houver problema, a próxima inspeção deve mostrar no log:
- delimitador detectado
- header=true/false
- colTypes
- emailCol
- motivo do fallback

Resumo técnico

A próxima correção precisa atacar o motivo do “retornou nada”:
- não deixar a detecção de delimitador/header usar lógica simplificada
- adicionar fallback por linha para achar o e-mail mesmo quando a coluna não for eleita
- forçar modo heurístico na VPS
- nunca devolver lista vazia sem diagnóstico
