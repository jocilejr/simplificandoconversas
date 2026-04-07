

## Fix: Dias para vencimento do boleto nao persistem

### Problema identificado

O bug esta em `FollowUpRulesConfig.tsx`. O componente tem sua propria query local para `boleto_settings` e usa `setExpirationDays` dentro do `queryFn` para inicializar o estado. Porem:

1. **Estado inicial vazio**: `expirationDays` inicia como `""`. Se a query retorna `null` (nenhuma configuracao salva ainda), o valor permanece vazio.
2. **Apos INSERT, o `settings` fica stale**: Quando o usuario salva pela primeira vez (INSERT), o `onSuccess` invalida a query. Porem, a variavel `settings` usada na closure da mutacao `updateSettings` pode nao ter atualizado ainda. Na proxima vez que salvar, a condicao `!settings?.id` pode estar errada.
3. **Re-mount reseta**: Ao fechar e reabrir o dialog, o componente re-monta, `expirationDays` volta para `""`, e a query re-roda. Se o dado foi salvo corretamente, deveria funcionar — mas se o INSERT falhou silenciosamente, o campo aparece vazio.
4. **Possivel falha silenciosa do INSERT**: A tabela `boleto_settings` no banco esta **vazia**, indicando que os INSERTs nunca foram persistidos com sucesso na VPS do usuario.

### Solucao

Refatorar o `FollowUpRulesConfig` para usar o hook `useBoletoRecovery` que ja tem `settings` e `updateSettings`, eliminando a duplicacao de logica. Alem disso, corrigir a inicializacao do `expirationDays` usando `useEffect` para sincronizar com os dados do banco quando carregados.

### Mudancas

**`src/components/followup/FollowUpRulesConfig.tsx`**:
- Remover a query local duplicada de `boleto_settings` — usar `settings` e `updateSettings` do `useBoletoRecovery()` que ja sao importados indiretamente
- Adicionar `useEffect` para sincronizar `expirationDays` com `settings?.default_expiration_days` quando os dados carregam
- Garantir que apos salvar, a invalidacao da query atualiza o estado corretamente
- Trocar a condicao do INSERT/UPDATE para usar o `settings` mais atualizado via re-render

**`src/hooks/useBoletoRecovery.ts`**:
- Nenhuma mudanca necessaria — o hook ja tem `settings` e `updateSettings` expostos

### Detalhes tecnicos

O fix principal e trocar:
```tsx
// ANTES — query separada com side-effect no queryFn
const { data: settings } = useQuery({
  queryFn: async () => {
    const { data } = await supabase.from("boleto_settings")...
    if (data) setExpirationDays(data.default_expiration_days.toString());
    return data;
  }
});
```

Para:
```tsx
// DEPOIS — useEffect para sincronizar estado
const { data: settings } = useQuery({ ... });

useEffect(() => {
  if (settings?.default_expiration_days) {
    setExpirationDays(settings.default_expiration_days.toString());
  }
}, [settings]);
```

E garantir que o `updateSettings` mutation invalide tambem o `["boleto-settings"]` query key corretamente.

| Arquivo | Acao |
|---------|------|
| `src/components/followup/FollowUpRulesConfig.tsx` | Fix: useEffect para sincronizar estado, remover side-effect do queryFn |

