
Objetivo

Corrigir a importação para separar corretamente:
- e-mail
- tags
- timestamp

sem deixar a IA transformar a linha inteira ou colunas erradas em e-mail.

Diagnóstico do código atual

O problema está no backend da VPS em `deploy/backend/src/routes/analyze-csv-contacts.ts`:
- hoje ele ainda tenta `analyzeWithAI(csvText)` antes da heurística
- se a IA devolver qualquer estrutura válida, o resultado é aceito sem validar a qualidade
- a heurística atual detecta “nome” de forma muito fraca e pode confundir tag/timestamp
- qualquer coluna que não seja e-mail ou nome vira tag, então o timestamp acaba indo junto

Plano de correção

1. Tornar o parser determinístico como caminho principal
- inverter a ordem do fluxo
- rodar primeiro `analyzeCSVHeuristic`
- só usar IA como fallback opcional quando o CSV realmente estiver ambíguo
- para seu caso na VPS, a estratégia recomendada é deixar o importador confiando no parser, não na IA

2. Melhorar a identificação de colunas
- criar regras explícitas para:
  - `isEmailLike`
  - `isTimestampLike`
  - `isTagLike`
  - `isHumanNameLike`
- escolher a coluna de e-mail apenas se ela tiver alta taxa de valores com exatamente um `@` e sem delimitadores extras
- impedir timestamp de ser escolhido como nome ou tag útil
- tratar valores como `etapa4`, `lead`, `grupo_x`, `campanha_y` como tag
- só aceitar nome quando parecer nome humano de verdade

3. Parar de importar lixo como e-mail
- validar cada valor de e-mail antes de normalizar
- rejeitar campo que:
  - contenha vírgula, `;`, `|` ou tab
  - contenha data/hora
  - tenha mais de um `@`
  - pareça a linha inteira do CSV
- isso evita casos como `email,tag,timestamp` indo para o campo de e-mail

4. Não jogar timestamp nas tags
- ao montar `tags`, ignorar colunas detectadas como timestamp/data
- usar apenas colunas realmente classificadas como tag
- se não houver nome real, salvar `name = null`

5. Endurecer o fallback com IA
- se a IA continuar habilitada, validar o retorno antes de aceitar
- rejeitar automaticamente respostas da IA onde o “email” pareça uma linha inteira ou contenha timestamp/tag misturado
- se rejeitar, cair para o resultado heurístico
- também posso adicionar um modo forçado como `CSV_ANALYZER_MODE=heuristic` para estabilizar a VPS

Arquivos a ajustar

- `deploy/backend/src/routes/analyze-csv-contacts.ts`
  - refatorar o fluxo para heurística primeiro
  - criar validadores de coluna/valor
  - separar melhor email/tag/timestamp
  - ignorar timestamp ao montar tags
  - validar/rejeitar retorno ruim da IA
  - melhorar logs

- opcionalmente `deploy/docker-compose.yml`
  - adicionar variável para forçar modo heurístico na VPS

Resultado esperado

Para linhas como:
```text
rosefujita2019@gmail.com,etapa4,2025-09-09 02:35:32.632
```

o sistema deve gerar:
```text
email = rosefujita2019@gmail.com
name = null
tags = ["etapa4"]
timestamp = ignorado
status = valid
```

Validação na VPS depois da implementação

Como você usa só a VPS, a conferência deve ser feita aí dentro. Depois da correção, vou te passar comandos para verificar:
```bash
cd /root/simplificandoconversas/deploy && ./update.sh
docker compose logs backend --tail=200 | grep analyze-csv
docker compose exec -T backend sh -lc 'echo ${CSV_ANALYZER_MODE:-auto}'
```

Resumo técnico

A correção não é “melhorar o prompt da IA”. A correção certa é:
- tirar a IA da decisão principal
- validar rigorosamente o que pode ser e-mail
- classificar timestamp separadamente
- usar tags apenas nas colunas corretas
