

# Melhorias na listagem de transações PIX órfãs

## Mudanças em `src/components/entrega/DeliveryFlowDialog.tsx`

### A) Paginação: mostrar 5 por vez com "Ver Mais"
- Novo estado `txLimit` iniciando em 5
- Exibir apenas `orphanTxs.slice(0, txLimit)` na lista
- Botão "Ver Mais" ao final que incrementa `txLimit += 5`
- Remover o `.limit(50)` da query para trazer todas as transações órfãs

### B) Campo de busca por nome ou CPF
- Novo estado `txSearch` (string)
- Input com ícone Search acima da lista, placeholder "Buscar por nome ou CPF..."
- Quando `txSearch` não está vazio: filtrar `orphanTxs` por `customer_name` ou `customer_document` contendo o texto (case-insensitive) e mostrar **todos** os resultados filtrados (sem limite de 5)
- Quando `txSearch` está vazio: aplicar paginação normal (5 em 5)
- Contador: "X transações encontradas"

### C) Ícone de verificado nas transações já vinculadas
- Alterar a query `handlePixClick` para buscar **todas** as transações PIX aprovadas (não apenas `customer_phone IS NULL`), mas manter a separação visual
- Na verdade, melhor abordagem: manter a query atual de órfãs para a lista principal, e quando o search é usado, buscar **todas** as transações PIX aprovadas (com e sem telefone) para mostrar resultados completos
- Transações que já possuem `customer_phone` preenchido exibem um ícone `BadgeCheck` azul ao lado do nome — e ficam desabilitadas (não clicáveis)
- Para isso, adicionar `customer_phone` ao select da query

### D) Ordenação
- Manter `.order("created_at", { ascending: false })` — mais recente primeiro (já está assim)

## Resumo do fluxo
1. Ao clicar PIX → busca todas transações PIX aprovadas (sem limit)
2. Lista mostra 5 mais recentes sem telefone
3. "Ver Mais" carrega +5
4. Search filtra por nome/CPF em todas as transações (incluindo vinculadas)
5. Vinculadas aparecem com ícone azul de verificado e não são clicáveis
6. Não vinculadas são clicáveis normalmente

## Arquivo alterado
- `src/components/entrega/DeliveryFlowDialog.tsx`

