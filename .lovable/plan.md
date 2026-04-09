
Objetivo: corrigir apenas a funcionalidade real da VPS, sem mexer em banco/RLS e sem ampliar escopo.

O que as verificações já provaram:
1. A tabela `member_products` da VPS está correta e usa `phone`, não `normalized_phone`.
2. O banco aceita insert normalmente.
3. Já existe registro real em `member_products`, então o fluxo não está “100% sem insert”; o problema restante é frontend/código legado.
4. O frontend self-hosted é servido pelo `deploy-nginx-1` a partir de `deploy/frontend`, então só “rebuildar containers” não garante frontend atualizado.
5. Ainda existem referências erradas a `normalized_phone` no código fonte.

Plano de implementação:
1. Corrigir `src/pages/AreaMembros.tsx`
   - trocar todas as leituras/escritas de `member_products.normalized_phone` para `member_products.phone`
   - corrigir busca por telefone (`ilike`) para usar `phone`
   - corrigir agrupamento/listagem para usar `phone`
   - corrigir verificação de duplicidade para selecionar `id, phone`
   - corrigir insert manual para gravar em `phone`
   - remover o update de `granted_at`, porque essa coluna não existe na VPS

2. Corrigir `src/components/membros/MemberClientCard.tsx`
   - ajustar a tipagem local de `MemberProduct` para `phone`
   - corrigir o histórico de compras para buscar transações por `customer_phone` em vez de `normalized_phone`
   - manter o restante do comportamento igual

3. Não alterar
   - `DeliveryFlowDialog.tsx` se ele já estiver usando `phone`
   - banco, migrations, RLS, backend Express e rotas
   - `src/integrations/supabase/types.ts`

4. Publicação correta para a VPS
   - gerar novo build do frontend
   - copiar o novo `dist` para `deploy/frontend`
   - só depois reiniciar/atualizar os containers do deploy
   - se vocês usam o script do projeto, aproveitar o fluxo já existente em `deploy/update.sh`, porque ele builda e copia o frontend antes do `docker compose up`

Verificações na VPS depois da implementação:
```bash
# 1) Confirmar que o nginx realmente está servindo os assets atualizados
docker exec deploy-nginx-1 sh -lc 'ls -lah /usr/share/nginx/html/assets'

# 2) Confirmar que o build servido não contém mais a referência antiga
docker exec deploy-nginx-1 sh -lc 'grep -R "normalized_phone" /usr/share/nginx/html/assets || true'

# 3) Testar o fluxo manual da Área de Membros e depois conferir os últimos registros
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "SELECT id, product_id, phone, is_active, created_at FROM member_products ORDER BY created_at DESC LIMIT 10;"

# 4) Se quiser validar também o histórico exibido no card
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "SELECT id, customer_phone, description, status, created_at FROM transactions WHERE customer_phone IS NOT NULL ORDER BY created_at DESC LIMIT 10;"
```

Detalhes técnicos importantes:
- O erro `grep: /usr/share/nginx/html/assets/*.js: No such file or directory` aconteceu porque o wildcard não foi expandido dentro do `docker exec`; o formato certo é com `sh -lc '...'`.
- O ponto mais crítico agora não é mais a tabela, e sim referências antigas no frontend:
  - `AreaMembros.tsx` ainda trata `member_products` como se tivesse `normalized_phone`
  - `MemberClientCard.tsx` ainda consulta `transactions.normalized_phone`, mas a tabela `transactions` usa `customer_phone`
- Como o `docker-compose.yml` monta `./frontend` no nginx, atualizar só containers pode deixar o JS antigo sendo servido se `deploy/frontend` não for regenerado.

Resultado esperado após aplicar o plano:
- liberar produto manualmente volta a inserir/reativar corretamente na VPS
- a listagem da Área de Membros volta a enxergar os registros existentes
- o card do membro volta a exibir histórico de compras
- sem mexer em banco e sem mudanças desnecessárias fora da funcionalidade
