

# Fix: Grupos selecionados somem ao reabrir campanha

## Problema

Ao abrir o diálogo de edição, dois `useEffect` competem:
1. **Effect 1** (linha 46-59): seta `instanceName` e `groupJids` a partir do `editData`
2. **Effect 2** (linha 62-99): dispara quando `instanceName` muda, busca grupos remotos e **limpa `groupJids` com `new Set()`** (linha 81)

O Effect 2 sempre roda após o Effect 1, sobrescrevendo os JIDs salvos da campanha com um Set vazio.

## Solução

No Effect 2 (fetch de grupos), ao invés de sempre limpar `groupJids`, preservar os JIDs que vieram do `editData` quando estiver em modo edição:

**Arquivo:** `src/components/grupos/GroupCampaignDialog.tsx`

- Remover o `setGroupJids(new Set())` de dentro do callback de fetch (linha 81)
- Apenas limpar groupJids quando a troca de instância for manual (não vinda do editData)
- Usar uma ref para rastrear se a instância foi setada pelo editData ou pelo usuário

Lógica concreta:
1. Adicionar `const editInstanceRef = useRef("")` para guardar a instância original do editData
2. No Effect 1, setar `editInstanceRef.current = editData.instance_name`
3. No Effect 2, após buscar grupos: se `instanceName === editInstanceRef.current` e temos `editData.group_jids`, restaurar esses JIDs; caso contrário, limpar normalmente
4. Resetar `editInstanceRef.current = ""` após consumir

Resultado: ao abrir para editar, os grupos salvos aparecem marcados; ao trocar instância manualmente, limpa corretamente.

