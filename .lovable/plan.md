

## Plano: Corrigir promoção automática de Super Admin

### Causa raiz confirmada
O trigger `on_profile_created_assign_admin` insere `admin` na tabela `user_roles` para todo perfil novo. O frontend (`useWorkspace.tsx`) detecta isso como Super Admin e ignora todas as permissões do workspace.

### Correções

**1. Remover o trigger e a função do banco (VPS)**

Adicionar ao `deploy/fix-member-tables.sql`:
```sql
DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.assign_admin_role();
```

**2. Limpar os admins globais indevidos (VPS)**

Remover o `admin` global dos colaboradores, mantendo apenas o seu (Jocile Júnior):
```sql
DELETE FROM user_roles 
WHERE role = 'admin' 
AND user_id != '46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6';
```

**3. Remover a função `assign_admin_role` do código-fonte**

No arquivo `deploy/init-db.sql`, remover a criação da função e do trigger para que não sejam recriados em futuras instalações.

**4. Remover da migration do Lovable Cloud**

No arquivo `supabase/migrations/20260307005032_15c3736a-3752-45ff-bb80-4813bc38a37f.sql`, remover o bloco que cria a função e o trigger.

### Comandos na VPS após deploy
```bash
cd ~/simplificandoconversas/deploy && docker exec -i deploy-postgres-1 psql -U postgres -d postgres < fix-member-tables.sql && bash update.sh
```

### Resultado esperado
- Seu colaborador (`080946ed`) passa a ver apenas: Leads, Entrega, Lembretes, Transações, Recuperação, Gerar Boleto
- Novos usuários criados não serão mais promovidos automaticamente a Super Admin
- Apenas `46ed58c8` (Jocile Júnior) permanece como Super Admin

### Arquivos modificados
- `deploy/fix-member-tables.sql` — adicionar DROP do trigger/função + DELETE dos admins indevidos
- `deploy/init-db.sql` — remover criação da função/trigger
- `supabase/migrations/20260307005032_...` — remover bloco da função/trigger

