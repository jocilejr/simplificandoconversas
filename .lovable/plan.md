

# Match de leads com prioridade: CPF → Telefone completo → 8 dígitos

## Problema

Atualmente o agrupamento usa apenas os últimos 8 dígitos, o que pode gerar falsos positivos (dois contatos diferentes com os mesmos 8 dígitos finais). Falta uma hierarquia de confiança no match.

## Solução — Arquivo único: `src/hooks/useLeads.ts`

### Lógica de merge com 3 níveis de prioridade

Ao iterar cada conversa, o sistema tenta encontrar um lead existente nesta ordem:

1. **CPF (prioridade máxima)** — Se a conversa tem transações com `customer_document`, busca no mapa se já existe um lead com o mesmo CPF. Se sim, faz merge (adiciona instância + acumula transações). CPF é único, impossível duplicar.

2. **Telefone normalizado completo (segunda prioridade)** — Usa `displayPhone()` para normalizar o número e busca match exato. Exemplo: `5524992011394` bate com `5524992011394`.

3. **Últimos 8 dígitos (terceira prioridade)** — Fallback atual. Agrupa variações como `5524992011394` e `24992011394`.

### Estrutura de dados interna

```text
Índices de lookup (todos apontam para o mesmo Lead):
  cpfIndex:   Map<string, Lead>     "12345678901" → Lead
  phoneIndex: Map<string, Lead>     "5524992011394" → Lead
  last8Index: Map<string, Lead>     "92011394" → Lead
```

Quando um lead é criado ou encontrado por qualquer nível, todos os índices são atualizados. Assim, matches futuros por qualquer critério apontam para o mesmo lead.

### Fluxo por conversa

```text
Para cada conversa C:
  cpf = buscar CPF nas transações de C (via matchKey do telefone)
  normalizedPhone = displayPhone(C.remote_jid)
  last8 = matchKey(C.remote_jid)

  existingLead = cpfIndex[cpf]          // prioridade 1
                 || phoneIndex[normalizedPhone]  // prioridade 2
                 || last8Index[last8]    // prioridade 3

  SE existingLead:
    → merge instância, acumula nome se vazio
    → registra todos os índices novos neste lead
  SENÃO:
    → cria novo Lead
    → registra nos 3 índices
```

### Transações — match também por CPF

O `txByPhone` atual indexa apenas por últimos 8 dígitos. Adicionamos um `txByCpf` (Map por `customer_document`) para que transações sem telefone mas com CPF também sejam vinculadas ao lead correto.

### Mudanças resumidas

| Item | Antes | Depois |
|------|-------|--------|
| Índices | 1 (`last8Index`) | 3 (`cpfIndex`, `phoneIndex`, `last8Index`) |
| Match de transação | Só por telefone | CPF primeiro, depois telefone |
| Falso positivo 8 dígitos | Possível | Impedido pelo CPF/telefone completo |
| Duplicação | Possível em edge cases | Impossível |

Sem mudança em outros arquivos — toda a lógica fica no hook.

