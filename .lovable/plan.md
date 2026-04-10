

## Corrigir Saudação IA — Diagnóstico e Fallback

### Problemas Identificados

1. **Backend provavelmente não foi reconstruído**: O curl retornou resposta vazia (nem JSON de erro), indicando que a rota `/ai-context` pode não existir no container atual. O código no repositório está correto, mas o container precisa ser rebuiltado.

2. **Sem fallback visual**: Quando a IA falha, o card fica vazio. O `greetingText` (linha 417) é calculado com fallback para `settings.welcome_message`, mas nunca é usado no card de saudação. O card só mostra texto se `aiContext?.greeting` existir.

### Correções

**1. Rebuild do backend na VPS**

Execute na VPS:
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Depois teste:
```bash
# Pegar workspace_id real
curl -s http://localhost:3001/api/member-access/TELEFONE_REAL_AQUI | python3 -m json.tool | grep workspace_id

# Testar ai-context com workspace_id real
curl -s -X POST http://localhost:3001/api/member-access/ai-context \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Teste","products":[],"ownedProductNames":[],"progress":[],"profile":{},"workspaceId":"ID_REAL_AQUI"}' | python3 -m json.tool
```

**2. Adicionar fallback no frontend — `src/pages/MemberAccess.tsx`**

Quando a IA falha, mostrar a `welcome_message` das configurações em vez de deixar o card vazio:

- Na seção do card de saudação (linhas 524-531), adicionar fallback:
  - Se `aiContext?.greeting` existe, mostrar
  - Senão, se `!aiLoading`, mostrar `settings?.welcome_message || "Bem-vindo(a) à sua área exclusiva!"` com estilo similar

```tsx
// Substituir o bloco de greeting (linhas 524-531)
) : (
  <>
    {visibleMessages >= 1 && (
      <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] text-gray-700 leading-relaxed w-fit max-w-[90%] animate-fade-in bg-gray-100">
        {aiContext?.greeting || `Olá${firstName ? `, ${firstName}` : ''}! ${settings?.welcome_message || 'Bem-vindo(a) à sua área exclusiva!'}`}
      </div>
    )}
  </>
)}
```

- Garantir que `setVisibleMessages(1)` é chamado mesmo quando a IA falha (adicionar no bloco catch/fallback da `loadAiContext`, linha 319):

```tsx
} catch {}
setAiLoading(false);
if (!aiContext) setVisibleMessages(1);  // fallback visual
```

Isso garante que mesmo sem OpenAI configurada, o membro vê uma mensagem de boas-vindas.

