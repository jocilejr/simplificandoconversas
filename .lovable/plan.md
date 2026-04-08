

# Fix: Limpar seleção de grupos ao trocar instância

## Problema
Ao trocar a instância no dialog de campanha, os grupos selecionados da instância anterior permanecem marcados. Isso causa contagem incorreta (ex: mostra 2 grupos selecionados quando só 1 existe na nova instância).

## Solução
No `useEffect` que detecta mudança de `instanceName`, **sempre** limpar `groupJids` — inclusive quando editando. A lógica atual só limpa quando `!editData`, mas precisa limpar em qualquer troca de instância.

**Arquivo:** `src/components/grupos/GroupCampaignDialog.tsx`

Na linha ~82, mudar:
```typescript
// Antes:
if (!editData) {
  setGroupJids(new Set());
}

// Depois:
setGroupJids(new Set());
```

Isso garante que toda troca de instância zera a seleção, forçando o usuário a re-selecionar os grupos corretos da nova instância.

