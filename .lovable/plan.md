

## Diagnóstico

O problema está no prompt do sistema da "IA Escuta" (linha 732 do `webhook.ts`). O prompt diz:

> "Sua tarefa é analisar a mensagem do contato e determinar se ela contém **informações relevantes** para criar um lembrete."

E injeta as regras do usuário apenas como contexto genérico:

> "Regras do usuário: {listenRules}"

Porém não há uma instrução **restritiva** dizendo que a IA deve criar lembretes **SOMENTE** quando a mensagem se encaixar nas regras definidas pelo usuário. Resultado: a IA interpreta "cirurgia de vesícula amanhã" como algo "relevante" e cria o lembrete, ignorando que as regras do usuário pedem apenas detecção de **pagamentos**.

## Solução

Alterar o `systemPrompt` no arquivo `deploy/backend/src/routes/webhook.ts` (linhas 732-753) para tornar as regras do usuário **restritivas e mandatórias**, não apenas contextuais.

### Alteração em `deploy/backend/src/routes/webhook.ts`

Reescrever o início do prompt do sistema para:

```
Você é um analisador de mensagens de WhatsApp. Sua ÚNICA tarefa é verificar se a mensagem se encaixa nas regras definidas abaixo.

REGRAS DE DETECÇÃO (definidas pelo usuário — siga ESTRITAMENTE):
${listenRules}

IMPORTANTE: Você deve criar um lembrete SOMENTE se a mensagem se encaixar claramente nas regras acima. Se a mensagem NÃO se encaixar nas regras, use a ferramenta no_action. Na dúvida, use no_action.
```

O restante do prompt (regras de data/horário, contexto do contato) permanece igual.

Essa mudança faz com que a IA trate as `listen_rules` como filtro obrigatório em vez de sugestão, impedindo que mensagens fora do escopo (como "cirurgia de vesícula") gerem lembretes indevidos.

