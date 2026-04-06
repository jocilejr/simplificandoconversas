

# Redesign completo de Leads + Limpeza de @lid

## 1. Corrigir erro de runtime (Contacts is not defined)
O erro parece ser de cache/stale build — o App.tsx atual está correto. Vou garantir que não há referências residuais.

## 2. Limpar contatos @lid do banco
Fornecer instruções para rodar na VPS:
```bash
docker compose exec postgres psql -U postgres -d postgres -c "DELETE FROM conversations WHERE remote_jid LIKE '%@lid';"
```

## 3. Filtrar @lid no hook `useLeads`
Adicionar filtro no query para excluir `remote_jid` que contenha `@lid`:
```typescript
.not("remote_jid", "like", "%@lid")
```

## 4. Mover "Leads" para seção Financeiro na sidebar
- **`src/components/AppSidebar.tsx`**: Remover "Leads" do `mainItems`, adicionar no início de `financeItems`

## 5. Redesign da página Leads — layout com cards
Substituir a tabela atual por um grid de cards informativos. Cada card mostra:
- **Nome** e **Número** (formatado)
- **Pagos**: quantidade de transações aprovadas
- **Valor**: montante total pago (formatado em BRL)
- **Email** (se houver, senão omite)
- **Agendamentos**: quantidade de reminders vinculados ao lead

Para isso, o hook `useLeads` precisa também buscar `reminders` e cruzar por `remote_jid`.

### Alterações no `useLeads`:
- Adicionar query de `reminders` (select `remote_jid`)
- Adicionar campo `remindersCount` e `paidOrdersCount` ao tipo `Lead`
- Filtrar `remote_jid` que contenha `@lid` no query de conversations

### Alterações na página `Leads.tsx`:
- Substituir `<Table>` por grid de `<Card>` responsivo (grid-cols-1 sm:2 lg:3)
- Cada card com layout compacto mostrando as métricas

## 6. Redesign do modal `LeadDetailDialog` — visão completa
O modal expandido mostra **tudo** sobre a pessoa, organizado em seções:

### Seção 1: Dados pessoais
- Nome completo, Telefone, CPF, Email, Tags

### Seção 2: Resumo financeiro
- Total pago, Quantidade de pedidos pagos, Quantidade de pedidos não pagos

### Seção 3: Transações (separadas em Pagas e Pendentes)
- Lista de transações aprovadas com valor, data, tipo
- Lista de transações pendentes/rejeitadas
- Botão "Baixar PDF" para boletos

### Seção 4: Agendamentos/Lembretes
- Lista de reminders vinculados ao lead (por `remote_jid`)
- Mostra título, data, status (pendente/concluído)

### Seção 5: Histórico de conversa (últimas mensagens)
- Buscar últimas N mensagens da tabela `messages` pelo `remote_jid`
- Mostrar um resumo compacto das últimas 10 mensagens

## Arquivos modificados
1. **`src/components/AppSidebar.tsx`** — mover Leads para Financeiro
2. **`src/hooks/useLeads.ts`** — adicionar reminders, filtrar @lid, novos campos
3. **`src/pages/Leads.tsx`** — redesign com grid de cards
4. **`src/components/leads/LeadDetailDialog.tsx`** — modal completo com todas as seções

## Resultado
- Leads na seção Financeiro da sidebar
- Sem contatos @lid no sistema
- Cards visuais com métricas úteis na listagem
- Modal com visão 360° do lead: dados, finanças, mensagens, agendamentos

