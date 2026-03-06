

## Plano: Conta admin única no instalador + bloquear cadastro público

### Resumo

O instalador pedirá email e senha do admin. Após subir os serviços, criará a conta via GoTrue API. O cadastro público será desabilitado (GoTrue + frontend).

### Mudanças

**1. `deploy/install.sh`** — Adicionar prompt de email/senha e criação da conta

No passo [2/7], após pedir os domínios, pedir também:
```
  Email do administrador: 
  Senha do administrador: (input oculto com -s)
```

Salvar `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.

Após aguardar o PostgreSQL (passo 6/7), adicionar um novo passo que:
- Espera o GoTrue ficar pronto (curl em loop no `http://gotrue:9999/health`)
- Cria o usuário admin via GoTrue Admin API:
```bash
curl -X POST http://localhost:9999/admin/users \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"...","email_confirm":true,"user_metadata":{"full_name":"Admin"}}'
```
- Usa `docker compose exec` para acessar o GoTrue internamente

**2. `deploy/docker-compose.yml`** — Desabilitar cadastro público

```yaml
GOTRUE_DISABLE_SIGNUP: "true"   # era "false"
```

**3. `src/pages/Auth.tsx`** — Remover opção de cadastro

- Remover o toggle "Não tem conta? Cadastre-se"
- Remover os campos de cadastro (nome, etc.)
- Manter apenas o formulário de login
- Título: "Entre na sua conta"

**4. `deploy/init-db.sql`** — Adicionar tabela `user_roles` e trigger de admin

Após a criação das tabelas, adicionar:
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Trigger: ao criar profile, inserir role baseado no email
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_assign_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_admin_role();
```

Como o cadastro está desabilitado, apenas o admin criado pelo instalador terá conta — o trigger atribui `admin` para qualquer profile criado (que só será o do instalador).

### Fluxo final do `bash install.sh`

```text
[1/8] Verificar Docker + Compose
[2/8] Pedir: APP_DOMAIN, API_DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD
[3/8] Gerar .env com secrets
[4/8] Buildar frontend (sem tela de cadastro, só login)
[5/8] Buildar + subir containers
[6/8] Aguardar PostgreSQL + GoTrue
[7/8] Criar conta admin via GoTrue API
[8/8] Resumo final
```

O resumo final mostrará:
```
  Admin: jocilejun@gmail.com
  Frontend: https://app.dominio.com
  API: https://api.dominio.com
```

