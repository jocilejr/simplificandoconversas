

# Fix: Parser CSV não separa colunas corretamente

## Diagnóstico

Olhando a screenshot, o campo "E-mail" mostra a linha inteira do CSV (ex: `denicedonda65@gmail.com,etapa8,2025-09-08 23:53:06.622`) ao invés de apenas o email. Isso significa que `parseCSVLine` está retornando a linha toda como uma única coluna.

**Causa raiz**: o CSV provavelmente usa **tab (`\t`)** como delimitador, mas o parser só reconhece `,` e `;`. Além disso, o CSV pode não ter linha de cabeçalho, o que faz o parser descartar a primeira linha de dados.

## Solução

Modificar `deploy/backend/src/routes/analyze-csv-contacts.ts`:

### 1. Auto-detectar delimitador
Antes de parsear, analisar as primeiras linhas para identificar o delimitador real (tab, vírgula, ponto-e-vírgula, pipe). Conta qual caractere aparece com mais consistência entre linhas.

### 2. Usar delimitador detectado no parseCSVLine
Passar o delimitador como parâmetro para `parseCSVLine` ao invés de hardcodar `,` e `;`.

### 3. Auto-detectar presença de header
Verificar se a primeira linha contém um `@` (indicando dados, não cabeçalho). Se sim, tratar como dados — sem pular a primeira linha.

### 4. Melhorar log para debug
Adicionar log do delimitador detectado, número de colunas, e se header foi encontrado.

## Arquivo a modificar

**`deploy/backend/src/routes/analyze-csv-contacts.ts`**:
- Nova função `detectDelimiter(lines)` que testa `\t`, `,`, `;`, `|` e retorna o que produz a contagem de colunas mais consistente
- Nova função `hasHeaderRow(firstLine, delimiter)` que verifica se a primeira linha contém `@` em alguma coluna
- Alterar `parseCSVLine` para receber o delimitador como parâmetro
- Alterar `analyzeCSVHeuristic` para usar as novas funções

## Detalhes técnicos

```text
detectDelimiter:
  Para cada delimitador candidato (\t , ; |):
    Conta colunas em cada uma das primeiras 5 linhas
    Se todas têm o mesmo nº de colunas > 1 → candidato válido
  Prioriza tab > vírgula > ponto-e-vírgula > pipe
  Fallback: vírgula

hasHeaderRow:
  Parseia linha[0] com o delimitador detectado
  Se alguma coluna contém "@" → provavelmente dados, não header
  Retorna false → não pular primeira linha
```

