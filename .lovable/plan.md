

# Filtrar números de telefone inválidos dos Leads

## Problema
A tabela `conversations` contém entradas com números de telefone inválidos (ex: 15 dígitos como "551514997684329"). Esses números foram inseridos pelo Evolution API e não representam contatos reais.

## Solução

### 1. Filtrar no hook `useLeads.ts`
Adicionar validação no query para excluir `remote_jid` com números fora do padrão brasileiro (deve ter entre 12 e 13 dígitos após remover `@s.whatsapp.net`). A filtragem será feita no `useMemo` que constrói os leads, verificando o comprimento do número extraído do `remote_jid`.

### 2. Limpeza no banco (instrução para VPS)
Fornecer comando SQL para identificar e remover registros com números inválidos:
```bash
# Ver quais estão errados
docker compose exec postgres psql -U postgres -d postgres -c "
  SELECT remote_jid, phone_number FROM conversations 
  WHERE remote_jid LIKE '%@s.whatsapp.net' 
  AND length(regexp_replace(split_part(remote_jid, '@', 1), '[^0-9]', '', 'g')) NOT BETWEEN 12 AND 13;
"

# Remover os inválidos
docker compose exec postgres psql -U postgres -d postgres -c "
  DELETE FROM conversations 
  WHERE remote_jid LIKE '%@s.whatsapp.net' 
  AND length(regexp_replace(split_part(remote_jid, '@', 1), '[^0-9]', '', 'g')) NOT BETWEEN 12 AND 13;
"
```

### 3. Melhorar formatação do telefone
Corrigir a função `formatPhone` para lidar melhor com números irregulares, mostrando o número bruto quando não se encaixa no padrão esperado, evitando formatação quebrada.

## Arquivos modificados
- `src/hooks/useLeads.ts` — filtro client-side para números com 12-13 dígitos
- `src/pages/Leads.tsx` — ajuste na formatação
- `src/components/leads/LeadDetailDialog.tsx` — ajuste na formatação

