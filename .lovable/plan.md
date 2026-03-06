

## Diagnóstico: VPS Limpa é a Melhor Decisão

Instalar numa VPS limpa elimina **todos** os conflitos que identificamos:
- Sem colisão de portas (5432, 80, 443, 8000)
- Sem conflito de volumes Docker ou nomes de containers
- Sem outro Supabase/Postgres competindo por recursos
- Sem redes Docker conflitantes

## Plano: Reescrever Todos os Arquivos de Deploy

### Arquitetura para VPS Limpa

```text
Internet (80/443)
    │
    ▼
  Traefik (SSL automático via Let's Encrypt)
    │
    ├── app.seudominio.com → Nginx (frontend SPA)
    │
    └── api.seudominio.com → Nginx (proxy interno)
            ├── /rest/v1/   → PostgREST
            ├── /auth/v1/   → GoTrue
            ├── /storage/v1/→ Storage
            ├── /functions/v1/ → Backend Express
            └── /baileys/   → Baileys Service
```

### Arquivos a reescrever

1. **`deploy/docker-compose.yml`** — Reescrever do zero:
   - Traefik como serviço com SSL automático (certresolver)
   - Postgres na `supabase/postgres:15.8.1.060` (versão estável)
   - GoTrue com healthcheck robusto e `start_period: 30s`
   - PostgREST, Storage, Baileys, Backend Express
   - Nginx interno para roteamento
   - Nomes de volumes com prefixo único (`chatbot_pgdata`, etc.)

2. **`deploy/init-auth-role.sh`** — Simplificar para apenas setar a senha do `supabase_auth_admin` (a imagem já cria o role)

3. **`deploy/init-db.sql`** — Remover linha 22 (`GRANT USAGE ON SCHEMA auth`). Manter todo o resto (tabelas, funções, triggers, roles)

4. **`deploy/install.sh`** — Reescrever para VPS limpa:
   - Instalar Docker + Docker Compose se necessário
   - Instalar Node.js 20 se necessário
   - Criar rede Docker `web`
   - Gerar secrets (JWT, Postgres password, Baileys API key, anon/service_role keys)
   - Solicitar domínios + credenciais admin
   - Build do frontend
   - `docker compose up -d`
   - Health checks (Postgres → GoTrue → PostgREST → Storage)
   - Criar conta admin via GoTrue API

5. **`deploy/update.sh`** — Manter lógica atual, apenas ajustar referências

6. **`deploy/nginx/default.conf.template`** — Manter como está (já correto)

7. **`deploy/portainer-stack.yml`** — Atualizar para refletir nova arquitetura (sem rede externa, Traefik embutido)

8. **`deploy/.env.example`** — Atualizar com todas as variáveis necessárias

### Mudanças principais vs. versão atual

| Item | Antes (problemas) | Depois (VPS limpa) |
|------|-------------------|-------------------|
| Proxy reverso | Referenciava Traefik externo que não existia | Traefik embutido no compose com SSL |
| Postgres image | `15.8.1.085` (instável) | `15.8.1.060` (testada) |
| init-auth-role.sh | Criava role/schema redundante | Apenas seta password |
| init-db.sql | GRANT em schema auth | Sem referência ao auth schema |
| Rede Docker | Dependia de rede externa `web`/`traefik` | Cria rede interna própria |
| Install script | Assumia infra existente | Instala tudo do zero |

