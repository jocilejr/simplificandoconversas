
Diagnóstico já confirmado:
- O problema não está mais no repasse entre componentes. `MemberAccess.tsx` já recebe `payload.customer?.name/document` e passa isso até `PaymentFlow`.
- `LockedOfferCard` e `PhysicalProductShowcase` já estão repassando `customerName` e `customerDocument`.
- `PaymentFlow` já tenta preencher automaticamente a partir dessas props.
- Então, se o modal continua vazio, o gargalo real está antes: `/api/member-access/:phone` não está devolvendo os dados completos/corretos do lead.

Hipótese mais provável:
1. O acesso do membro é encontrado por `member_products.phone`, mas o lead é buscado separadamente em `customers.normalized_phone`.
2. O matching do customer no backend ainda é frágil: usa variações exatas do telefone, mas não reaproveita o telefone efetivamente casado no acesso nem faz fallback consistente por últimos 8 dígitos.
3. O CPF pode não estar em `customers.document` para esse lead específico, mesmo existindo no histórico/transações.
4. Hoje PIX e Cartão criam transação com os valores vindos das props, não com um “customer resolvido” único e confiável.

Plano de investigação na VPS:
1. Validar o JSON real do endpoint que alimenta a área de membros:
```bash
curl "http://localhost:3001/api/member-access/SEU_TELEFONE"
```
Conferir se `customer.name` e `customer.document` vêm preenchidos.

2. Conferir onde o lead realmente está salvo:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "select column_name from information_schema.columns where table_name='customers' order by ordinal_position;"
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "select workspace_id, normalized_phone, name, document, first_seen_at, total_paid, total_transactions from customers where normalized_phone like '%ULTIMOS8%' order by first_seen_at desc nulls last limit 20;"
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "select workspace_id, phone, product_id, is_active from member_products where phone like '%ULTIMOS8%' order by granted_at desc nulls last limit 20;"
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "select workspace_id, customer_phone, customer_name, customer_document, created_at from transactions where customer_phone like '%ULTIMOS8%' order by created_at desc limit 20;"
```

3. Comparar os 3 lugares para o mesmo lead:
- `member_products.phone`
- `customers.normalized_phone`
- `transactions.customer_phone`

Se um deles estiver em formato diferente, o `member-access` atual falha no preenchimento automático.

Correção que vou aplicar após sua aprovação:
1. Fortalecer `deploy/backend/src/routes/member-access.ts`
- Transformar a busca do customer em uma resolução hierárquica:
  - telefone exato
  - com/sem `55`
  - com/sem 9º dígito
  - fallback por últimos 8 dígitos
- Reaproveitar o telefone efetivamente encontrado no acesso do membro.
- Retornar no payload:
  - `customer.name`
  - `customer.document`
  - `customer.matched_phone`

2. Adicionar fallback de CPF
- Se `customers.document` vier vazio, buscar `customer_document` na transação mais recente do mesmo lead dentro do workspace.
- Assim o modal deixa de depender de um único lugar para achar o CPF.

3. Ajustar `src/components/membros/PaymentFlow.tsx`
- Inicializar um estado local único de cliente quando o modal abrir, não só ao entrar no step boleto.
- Fazer PIX, Cartão e Boleto usarem esse mesmo customer resolvido.
- Garantir que a transação seja criada com nome + CPF corretos em qualquer método de pagamento.

Arquivos que realmente precisam ser alterados:
- `deploy/backend/src/routes/member-access.ts`
- `src/components/membros/PaymentFlow.tsx`

Resultado esperado:
- A área de membros continuará encontrando o acesso pelo telefone.
- O modal passará a abrir já com nome e CPF corretos.
- PIX, Cartão e Boleto passarão a registrar a transação com os dados reais do lead.

Se quiser acelerar a investigação antes da implementação, me envie a saída dos comandos da VPS acima, porque isso vai mostrar exatamente onde o CPF está e qual formato de telefone está quebrando o matching.
