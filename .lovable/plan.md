

# Redesign da aba Entrega Digital — Fluxo integrado no card do produto

## Resumo

Ao clicar no card do produto, abre um painel/dialog com fluxo em etapas:
1. **Nome do cliente** + telefone → botão "Continuar"
2. **3 cards visuais grandes** para selecionar método de pagamento (PIX, Cartão, Boleto)
3. **Busca do lead** com resultado minimalista — card com informações básicas (CPF, nome, email, telefone, produtos com acesso)
4. **Confirmação + link gerado**

Remove o botão separado "Gerar Link" dos cards de produto.

## Arquivos alterados

### 1. `src/components/entrega/ProductsTab.tsx`
- Remover o state `linkProduct` e o componente `LinkGenerator` separado
- Ao clicar no card do produto, abrir o novo dialog `DeliveryFlowDialog` passando o produto selecionado
- Remover o botão de ícone `Link2` da lista de ações do card

### 2. `src/components/entrega/LinkGenerator.tsx` → **Reescrever como `DeliveryFlowDialog.tsx`**
- Novo componente com 4 etapas visuais:

**Etapa 1 — Dados do cliente:**
- Campo "Nome do cliente" (obrigatório)
- Campo "Telefone" (obrigatório)
- Botão "Continuar"

**Etapa 2 — Método de pagamento (3 cards grandes):**
- Card PIX: ícone QR code, título "PIX", descrição "Pagamento instantâneo"
- Card Cartão: ícone CreditCard, título "Cartão de Crédito", descrição "Parcelamento disponível"
- Card Boleto: ícone FileText, título "Boleto Bancário", descrição "Vencimento em 3 dias úteis"
- Cards com hover, borda highlight ao selecionar, estilo visual grande (h-32+)
- Ao clicar num card, avança automaticamente para etapa 3

**Etapa 3 — Resultado (busca lead + card de informações):**
- Busca silenciosa do lead (sem steps visuais "buscando lead...")
- Exibe um card minimalista com as informações encontradas:
  - Nome completo
  - CPF (da tabela `transactions` campo `customer_document`)
  - Email (da tabela `conversations` campo `email`)
  - Telefone normalizado
  - Lista de produtos com acesso (da tabela `member_products`)
- Se lead não encontrado, mostra card com dados parciais (só nome digitado + telefone)
- Concede acesso automaticamente (`member_products` upsert)
- Registra `delivery_link_generations`
- Se PIX, cria transação aprovada

**Etapa 4 — Link gerado:**
- Card com link de acesso + botão copiar
- Botão "Gerar outro"

### 3. `src/components/entrega/ProductsTab.tsx` — Ajuste no card
- Manter botões de editar, duplicar, excluir
- Remover botão `Link2`
- Todo o card (área de nome/slug/valor) é clicável e abre o `DeliveryFlowDialog`

## Detalhes técnicos

- A busca do lead usa `conversations` por telefone normalizado (last8 fallback) para obter nome/email
- CPF vem de `transactions` onde `customer_phone` match com variações do telefone
- Produtos com acesso vem de `member_products` filtrado por `normalized_phone`
- Todas as queries são feitas em paralelo na etapa 3 para velocidade
- O dialog usa `max-w-lg` para comportar os 3 cards lado a lado

