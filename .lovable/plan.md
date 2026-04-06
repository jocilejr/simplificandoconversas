
Objetivo

Criar uma solução específica para o padrão real do seu arquivo, em vez de continuar tentando “adivinhar” colunas genericamente.

Problema real

O TXT enviado tem um formato consistente e simples:

```text
email,tag,timestamp
rosefujita2019@gmail.com,etapa4,2025-09-09 02:35:32.632
```

O importador atual ainda tenta fazer detecção genérica de colunas. Isso falha porque:
- o arquivo não tem cabeçalho
- a 1ª coluna contém e-mails com alguns erros de digitação
- a 2ª coluna é uma tag curta (`etapa4`, `etapa8`, etc.)
- a 3ª coluna é sempre timestamp e deve ser ignorada

Resultado: o sistema às vezes não elege nenhuma coluna de e-mail e retorna vazio.

Solução que vou implementar

1. Criar um parser dedicado para esse padrão
- Detectar automaticamente quando o arquivo seguir o padrão:
  - 3 colunas
  - coluna 1 = e-mail
  - coluna 2 = tag
  - coluna 3 = timestamp
- Quando esse padrão for reconhecido, parar de usar heurística genérica para esse caso

2. Separar os campos de forma fixa
- `coluna 1` → `email`
- `coluna 2` → `tags = [valor]`
- `coluna 3` → ignorar completamente
- `name = null`

3. Usar normalização de e-mail apenas na 1ª coluna
- Corrigir domínios com erro de digitação
- Manter a parte local intacta
- Se a linha tiver e-mail inválido, marcar como inválida com motivo, sem quebrar a importação inteira

4. Aceitar TXT além de CSV
- Atualizar o seletor de arquivo para aceitar `.txt` e `.csv`
- Ajustar os textos da interface para refletir isso

5. Melhorar o diagnóstico
- O backend vai retornar modo de análise e amostras do parse
- Se o formato fixo não for reconhecido, aí sim cai para o modo heurístico
- O frontend passa a exibir erro mais claro quando o arquivo não seguir nenhum formato reconhecido

Arquivos a ajustar

- `deploy/backend/src/routes/analyze-csv-contacts.ts`
  - adicionar detector de “formato fixo email/tag/timestamp”
  - adicionar parser dedicado para esse formato
  - usar esse parser antes da heurística genérica
  - manter timestamp fora de tags e fora de nome

- `src/hooks/useEmailContacts.ts`
  - melhorar o tratamento de erro/debug retornado pelo backend

- `src/components/email/EmailContactsTab.tsx`
  - aceitar `.txt,.csv`
  - ajustar textos de importação para não falar só “CSV”

Resultado esperado

Para uma linha como:

```text
rosefujita2019@gmail.com,etapa4,2025-09-09 02:35:32.632
```

o sistema deverá gerar:

```text
email = rosefujita2019@gmail.com
name = null
tags = ["etapa4"]
timestamp = ignorado
status = valid
```

Para linhas com erro:

```text
socorrolopes8460@gmailcom.br,etapa4,2025-09-09 02:48:12.304
```

o sistema deverá:
- tentar corrigir o e-mail
- importar se a correção for confiável
- ou marcar como inválido com motivo

Detalhes técnicos

```text
Fluxo novo:
1. Ler linhas não vazias
2. Detectar se >= grande maioria das linhas tem:
   - 3 colunas
   - 3ª coluna timestamp
   - 2ª coluna tag curta
   - 1ª coluna parecendo campo de e-mail
3. Se sim:
   - parser fixo
4. Se não:
   - heurística genérica existente como fallback
```

Sem mudanças de banco
- Não precisa migration
- Não precisa alterar autenticação
- Não precisa alterar tabelas

Validação dentro da VPS

Depois da implementação, a conferência deve ser feita aí dentro:

```bash
cd /root/simplificandoconversas/deploy && ./update.sh
```

```bash
cd /root/simplificandoconversas/deploy
docker compose logs backend --tail=200 | grep analyze-csv
```

Para confirmar que a VPS está com a versão certa do parser:

```bash
cd /root/simplificandoconversas/deploy
docker compose exec -T backend sh -lc 'grep -n "fixed-format" dist/routes/analyze-csv-contacts.js'
```

Se ainda falhar, o próximo passo de investigação na VPS será:

```bash
cd /root/simplificandoconversas/deploy
docker compose logs backend --tail=300
```

e conferir se o log mostra:
- `mode=fixed-format`
- quantidade de linhas reconhecidas
- motivo de fallback, se houver

Resumo

A solução certa aqui não é insistir em IA nem em heurística ampla. É criar um caminho dedicado para o padrão real do seu arquivo TXT:
- 1ª coluna = e-mail
- 2ª coluna = tag
- 3ª coluna = timestamp ignorado
