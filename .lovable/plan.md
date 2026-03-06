
## Deploy para VPS Limpa — Concluído ✅

Todos os arquivos de deploy foram reescritos para funcionar em uma VPS limpa com Traefik embutido e SSL automático.

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `deploy/docker-compose.yml` | Reescrito: Traefik embutido, Postgres 15.8.1.060, volumes prefixados `chatbot_*`, sem rede externa |
| `deploy/portainer-stack.yml` | Reescrito: mesma arquitetura do docker-compose.yml |
| `deploy/init-auth-role.sh` | Simplificado: apenas seta password do `supabase_auth_admin` |
| `deploy/init-db.sql` | Removida linha `GRANT USAGE ON SCHEMA auth` |
| `deploy/install.sh` | Reescrito: instala Docker+Node.js, gera secrets, Traefik auto-SSL, health checks |
| `deploy/.env.example` | Atualizado: inclui `ACME_EMAIL` e credenciais admin |

### Como usar na VPS limpa

```bash
# 1. Clonar o repositório
git clone <repo> && cd <repo>/deploy

# 2. Executar instalação
chmod +x install.sh && ./install.sh

# 3. O script vai:
#    - Instalar Docker e Node.js (se necessário)
#    - Solicitar domínios, email SSL e credenciais admin
#    - Gerar todos os secrets automaticamente
#    - Buildar frontend e containers
#    - Configurar Traefik com SSL Let's Encrypt
#    - Criar conta admin no GoTrue
```
