

## Diagnóstico confirmado

Os dados da VPS mostram:
- Todos os PIX têm `type = 'pix'` e `status = 'aprovado'` ou `'pendente'` — **não há problema de filtro de tipo ou status**
- São 42 transações aprovadas — todas deveriam aparecer

O problema real está na **linha 191** do `DeliveryFlowDialog.tsx`:
```
return [...orphans, ...currentLead, ...otherLead].slice(0, txLimit);
```

Isso reagrupa as transações por categoria **antes** de paginar. Como `txLimit` começa em 5, só aparecem as primeiras 5 (geralmente as sem telefone/"orphans"). Transações recentes que já têm `customer_phone` vinculado a outro contato vão para o final da lista e ficam escondidas.

## Plano de correção

### Arquivo: `src/components/entrega/DeliveryFlowDialog.tsx`

**1. Remover reagrupamento, manter ordem cronológica**
- Linha 180-191: Substituir a lógica de agrupamento por uma simples exibição em ordem de `paid_at DESC` (que já vem da query)
- Manter os badges visuais (verde "Já contabilizada", azul "Vinculada", desabilitada) — apenas sem mudar a posição dos itens
- O `txLimit` continua funcionando, mas agora pagina cronologicamente

**2. Aumentar limite inicial**
- Trocar `txLimit` inicial de 5 para 10 para mostrar mais transações de cara

**3. Scroll — já corrigido**
- A correção anterior (`max-h-[calc(70vh-200px)]` + remoção do `overflow-y-auto` do pai) já está no código

### Resultado esperado
- Os PIX mais recentes (ex: MARIA CARMO de R$70, Jocile de R$1) aparecem no topo
- "Ver mais" expande mantendo a mesma ordem cronológica
- Badges visuais continuam indicando status de vinculação

