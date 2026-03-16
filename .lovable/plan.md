

## Problema

O prompt do sistema (linha 702-710) diz a data/hora atual ao modelo, mas não dá instruções explícitas de como resolver datas relativas como "dia 12", "na quarta", "semana que vem". O GPT-4o-mini frequentemente interpreta "dia 12" como o dia 12 do mês atual (mesmo que já tenha passado), e "quarta" como a quarta do mesmo bloco semanal.

A imagem mostra exatamente isso: "Pagamento a ser feito no dia 12" gerou `12/03/2026 às 06:00`, que já é passado (estamos em 16/03), resultando em badge "Atrasado" desde a criação.

## Solução

Alterar o `systemPrompt` na função `checkAndAutoListen` (`deploy/backend/src/routes/webhook.ts`, linhas 702-710) para incluir regras explícitas de resolução de datas relativas:

**Regras a adicionar no prompt:**
- "dia X" → se o dia X do mês atual já passou, usar o dia X do próximo mês
- "segunda/terça/.../domingo" → se o dia da semana mencionado já passou nesta semana, usar o da próxima semana
- "semana que vem" → próxima semana
- "mês que vem" → próximo mês
- Nunca gerar uma `due_date` no passado

**Alteração concreta** — apenas o conteúdo do `systemPrompt` (linhas 702-710):

```
Você é um analisador de mensagens de WhatsApp...

REGRAS DE DATA IMPORTANTES:
- Data/hora atual: ${now}
- Quando o contato mencionar "dia X": se o dia X deste mês já passou, agende para dia X do PRÓXIMO mês.
- Quando mencionar um dia da semana (ex: "quarta", "sexta"): se esse dia já passou nesta semana, agende para o mesmo dia da PRÓXIMA semana.
- NUNCA gere uma due_date anterior à data/hora atual.
- Se não houver data específica, use amanhã às 09:00.
```

Nenhuma outra alteração é necessária — a lógica de tool calling, inserção no banco e estrutura permanecem iguais.

