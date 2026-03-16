

## Problema

1. **Fuso horário errado**: `new Date().toISOString()` retorna UTC. O modelo recebe hora UTC e calcula errado — "6 da tarde" vira 15h, "segunda" vira sexta, porque o dia da semana pode diferir entre UTC e Brasília.
2. **Falta de instrução explícita de fuso**: O prompt não diz ao modelo qual timezone usar.

## Solução

Alterar `deploy/backend/src/routes/webhook.ts` (linhas 701-722):

**1. Gerar `now` em horário de Brasília formatado legível:**
```typescript
const brasiliaDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
const diasSemana = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const now = brasiliaDate.toISOString().replace("T", " ").slice(0, 16);
const diaSemanaAtual = diasSemana[brasiliaDate.getUTCDay()];
```

**2. Atualizar o prompt** para incluir dia da semana atual e regras de horário mais explícitas:

- Informar: `Agora é ${diaSemanaAtual}, ${now} (horário de Brasília, UTC-3)`
- Adicionar regra: "Quando o contato mencionar horários como '6 da tarde', '3 da manhã', '10h', interprete literalmente. '6 da tarde' = 18:00, '3 da tarde' = 15:00, 'meio-dia' = 12:00."
- Adicionar regra: "Todas as datas retornadas em due_date devem estar em UTC. Converta de Brasília (UTC-3) para UTC somando 3 horas."
- Incluir o dia da semana atual para evitar confusão com "segunda"/"sexta"

Nenhuma outra alteração necessária — só o bloco do `systemPrompt` e a variável `now`.

