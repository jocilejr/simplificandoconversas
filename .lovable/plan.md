
Objetivo revisado: corrigir a lógica que continua quebrada mesmo com a build certa. Pela leitura do código, o problema mais provável não é mais deploy, e sim regra de escrita/links ainda incorreta no frontend.

Diagnóstico do código atual:
1. `src/pages/AreaMembros.tsx` ainda tem uma falha funcional real:
   - o insert manual usa `phone: digits`, sem normalizar com a mesma regra usada no restante do sistema
   - o insert manual não força `is_active: true`
   - a reativação existente faz `update(...)` sem checar `error`
2. `src/components/entrega/LinkGenerator.tsx` e `src/components/entrega/DeliveryFlowDialog.tsx` ignoram erros de `upsert/insert`
   - hoje o fluxo pode falhar e mesmo assim mostrar sucesso
3. Os links copiados apontam para `/membros/{telefone}`, mas o app atual só tem rota `/area-membros` e `/r/:code`
   - não existe rota `/membros/:phone` no `src/App.tsx`
   - então, mesmo com acesso salvo corretamente, o link gerado/copiado tende a não funcionar

Plano de correção:
1. Ajustar a liberação manual em `src/pages/AreaMembros.tsx`
   - normalizar o telefone com a mesma função usada no fluxo de entrega
   - trocar a lógica atual de select + update/insert por um `upsert` consistente com a VPS:
     - `workspace_id`
     - `product_id`
     - `phone`
     - `is_active: true`
     - `onConflict: "product_id,phone"`
   - validar e exibir qualquer erro real antes de mostrar sucesso

2. Endurecer os fluxos que liberam acesso fora da Área de Membros
   - revisar `src/components/entrega/LinkGenerator.tsx`
   - revisar `src/components/entrega/DeliveryFlowDialog.tsx`
   - em ambos:
     - checar `error` em cada `insert`, `upsert`, `update` e `single`
     - abortar o fluxo se qualquer etapa falhar
     - só mostrar toast de sucesso quando a gravação realmente acontecer

3. Corrigir o problema do link de acesso
   - como hoje não existe rota `/membros/:phone`, decidir a implementação correta:
     - ou criar a rota/página pública do membro
     - ou parar de gerar `/membros/{phone}` e usar apenas um link que já exista de verdade
   - sem isso, “copiar link” continuará quebrado mesmo com `member_products` correto

4. Não mexer agora
   - banco/RLS
   - migrations
   - `src/integrations/supabase/client.ts`
   - `src/integrations/supabase/types.ts`

Verificações na VPS antes/depois da implementação:
```bash
cd ~/simplificandoconversas

# 1) Provar que hoje não existe rota pública /membros
grep -n 'path="/membros' src/App.tsx || echo "SEM ROTA /membros"
grep -n 'path="/area-membros"' src/App.tsx

# 2) Provar que o link copiado aponta para uma rota inexistente
grep -n '/membros/' src/components/membros/MemberClientCard.tsx
grep -n '/membros/' src/components/leads/LeadDetailDialog.tsx

# 3) Verificar a lógica atual da liberação manual
grep -n 'phone: digits' src/pages/AreaMembros.tsx
grep -n 'is_active: true' src/pages/AreaMembros.tsx

# 4) Verificar pontos onde o código grava sem checar erro
grep -n 'from("member_products").upsert' src/components/entrega/LinkGenerator.tsx
grep -n 'from("member_products").upsert' src/components/entrega/DeliveryFlowDialog.tsx
```

Resultado esperado após a correção:
- liberar produto manualmente grava no formato certo e ativo de verdade
- o fluxo deixa de “fingir sucesso” quando houver erro
- o acesso do membro passa a depender de um link real, e não de uma rota inexistente
- se ainda restar problema, ele aparecerá como erro concreto e não mais como falha silenciosa
