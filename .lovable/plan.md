
Diagnóstico

- O cadastro manual está funcionando: o registro já existe na VPS em `member_products`.
- O problema agora é de leitura/exibição.
- O código atual depende de relacionamento embutido `delivery_products(...)` em consultas ao `member_products`.
- Na sua VPS, pelo `\d member_products` que você enviou antes, não aparece foreign key de `product_id` para `delivery_products(id)`. Sem esse vínculo, essas consultas embutidas podem falhar.
- Em `src/components/leads/LeadDetailDialog.tsx`, esse erro ainda fica mascarado: se a API devolver um JSON de erro, o código converte para `[]` e mostra “Nenhum produto liberado”, mesmo com registro existente.

Plano de correção

1. `deploy/backend/src/routes/platform-api.ts`
   - Reescrever o endpoint `/member-products` para não usar `delivery_products(name)` direto.
   - Buscar primeiro `member_products` por `workspace_id + phones`.
   - Buscar depois os `delivery_products` pelos `product_id`.
   - Montar a resposta manualmente com o nome do produto.

2. `deploy/backend/src/routes/member-access.ts`
   - Aplicar a mesma lógica no endpoint público de acesso.
   - Remover a dependência de relacionamento implícito entre `member_products` e `delivery_products`.
   - Isso corrige também o link público do membro, não só o modal do lead.

3. `src/pages/AreaMembros.tsx`
   - Trocar `.select("*, delivery_products(name)")` por leitura em 2 etapas + merge no frontend.
   - Assim a aba de membros volta a mostrar os acessos liberados mesmo com o schema atual da VPS.

4. `src/components/leads/LeadDetailDialog.tsx`
   - Ajustar o fetch de produtos liberados para lançar erro quando a API responder falha.
   - Evitar o falso vazio silencioso que hoje vira “Nenhum produto liberado”.

5. Consistência futura da VPS
   - Atualizar os arquivos de deploy/schema do projeto para refletirem o formato real usado hoje em `member_products`.
   - Não vou depender disso para a correção imediata, mas deixarei a base preparada para próximos deploys.

Validação na VPS depois do deploy

```bash
docker logs deploy-backend-1 --since 10m | grep -Ei "member-products|member-access"

docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT mp.id, mp.phone, mp.product_id, mp.is_active, dp.name
FROM member_products mp
LEFT JOIN delivery_products dp ON dp.id = mp.product_id
WHERE mp.phone IN ('5589981340810','89981340810');
"
```

Resultado esperado

- No detalhe do lead da Jocile, “Produtos Liberados” deve sair de 0 para 1
- O produto deve aparecer com nome no card
- A aba Área de Membros deve mostrar esse acesso
- O link público `/{telefone}` também deve passar a listar o produto corretamente
