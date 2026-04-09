

# Fix: Lógica de badge "Já contabilizada" para transações auto-vinculadas

## Problema atual
O backend já faz a engenharia reversa corretamente — quando um PIX chega com CPF conhecido, ele auto-vincula o telefone do lead na transação. Porém, no `DeliveryFlowDialog`, a lógica de detecção de "já contabilizada" exige que `customer_phone` seja null (`!isLinked`). Como o backend JÁ preencheu o telefone, essas transações aparecem como "Vinculada" (azul, desabilitada) em vez de "Já contabilizada" (verde, clicável).

## Solução

### Arquivo: `src/components/entrega/DeliveryFlowDialog.tsx`

**1) Corrigir `isAlreadyCounted`** — Uma transação é "já contabilizada" em dois cenários:
- Sem telefone + CPF = leadCpf (órfã que o backend não conseguiu resolver, mas o CPF bate)
- Com telefone = telefone do lead atual + CPF = leadCpf (backend já auto-vinculou)

**2) Ajustar `filteredTxs`** — Incluir na lista padrão (sem busca) as transações que já têm o telefone do lead atual (auto-vinculadas pelo backend), além das órfãs.

**3) Ajustar `isDisabled`** — Transações vinculadas a OUTROS contatos continuam desabilitadas (azul). Transações vinculadas ao lead ATUAL via CPF ficam clicáveis (verde).

**4) `processDelivery` sem mudanças** — A flag `alreadyCounted=true` já faz o correto: só libera acesso sem re-vincular valores.

### Lógica corrigida (pseudocódigo):
```text
isLinkedToCurrentLead = tx.customer_phone matches phone do lead atual
isAlreadyCounted = leadCpf && tx.customer_document === leadCpf && (isLinkedToCurrentLead || !tx.customer_phone)
isDisabled = tx.customer_phone exists && !isLinkedToCurrentLead && !isAlreadyCounted
```

### Filtro padrão (sem busca):
```text
Mostrar se:
  - Sem customer_phone (órfã) → sempre
  - Com customer_phone = lead atual E CPF = leadCpf → já contabilizada
  - Demais com customer_phone → esconder (a menos que busca ativa)
```

## Resultado esperado
- PIX auto-vinculado pelo backend → aparece com badge verde "Já contabilizada" → clique só libera acesso
- PIX órfão → aparece sem badge → clique vincula telefone + valor + libera acesso
- PIX de outro contato → azul, desabilitado (só aparece na busca)
