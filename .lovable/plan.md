

# Comparação: Finance Hub vs. Follow-Up Daily atual

## Análise da lógica

Após revisar detalhadamente o [Finance Hub](/projects/d89d7fe0-aec2-4559-ab78-93b0f65c21d2), a **lógica da régua no `followup-daily.ts` já está correta** e alinhada com o Finance Hub. Os pontos essenciais coincidem:

| Aspecto | Finance Hub | Seu backend (`followup-daily.ts`) |
|---|---|---|
| Cálculo de dias | `calcDaysSince()` com timezone Brasil | `daysBetween()` com timezone Brasil |
| Matching de regras | `days_after_generation`, `days_before_due`, `days_after_due` | Mesma lógica, mesma ordem por priority |
| Dedup por transaction+rule | `sentTodayKeys` Set | `alreadyContacted` Set |
| Template variables | `{saudação}`, `{primeiro_nome}`, `{valor}`, `{vencimento}`, `{codigo_barras}` | Idêntico |
| Blocos de mídia | PDF + Image via template blocks | PDF + Image com conversão local |
| Anti-ban | Delay + batch pause via settings | MessageQueue com delay + cooldown |

## Diferenças encontradas (melhorias do Finance Hub que faltam)

### 1. Dedup por telefone (evitar spam ao mesmo número)
O Finance Hub tem uma proteção extra: rastreia quantas mensagens cada **telefone** já recebeu hoje e respeita um limite `max_messages_per_person_per_day`. Seu backend não tem isso — se o mesmo cliente tiver 2 boletos com regras diferentes, recebe 2 mensagens.

### 2. Re-check de status antes do envio
Seu `followup-daily.ts` **já faz** re-check (`tx.status !== "pendente"` antes de enviar). Correto.

### 3. Filtro `neq('rule_type', 'immediate')`
O Finance Hub exclui regras do tipo `immediate` da busca diária (essas são usadas só no envio instantâneo). Suas tabelas não têm regras `immediate`, mas seria uma boa proteção futura.

## Plano de melhorias

### 1. Adicionar dedup por telefone (`followup-daily.ts`)
- Antes de processar boletos, construir um `Map<string, number>` com os últimos 8 dígitos dos telefones já contactados hoje
- Pular envio se o telefone já atingiu o limite (default: 1 msg/dia)
- Adicionar campo `max_messages_per_phone_per_day` na tabela `followup_settings` (migration)

### 2. Filtrar regras `immediate` (`followup-daily.ts`)
- Adicionar `.neq("rule_type", "immediate")` na query de regras para não enviar regras de disparo instantâneo no cron diário

### 3. Corrigir timezone na query de dedup
O código atual usa `todayStart = ${today}T00:00:00.000Z` (UTC). Deveria usar offset `-03:00` para Brasília, como o frontend faz: `${todayStr}T00:00:00-03:00`.

## Arquivos alterados
1. `deploy/backend/src/routes/followup-daily.ts` — Dedup por telefone, filtro `immediate`, fix timezone

## Escopo
Não há necessidade de reescrever a lógica — apenas 3 ajustes pontuais. A estrutura está correta.

