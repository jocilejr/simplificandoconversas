

## Fix: Docker Compose Dependency Cycle

### Problem
Backend depends on nginx (`depends_on: nginx`), and nginx depends on backend (`depends_on: backend`). This creates a circular dependency that prevents containers from starting.

### Solution
Remove `backend` from nginx's `depends_on`. Nginx doesn't actually need backend to be running first -- it proxies to backend, and nginx will retry connections. The backend needs nginx for Supabase client routing, but we can also remove that strict dependency and let Docker's restart policy handle transient failures.

### Changes

**1. `deploy/docker-compose.yml`** (and `deploy/portainer-stack.yml`):

- Remove `backend` from nginx's `depends_on` (line 192)
- Remove `nginx` from backend's `depends_on` (lines 167-168)

Nginx `depends_on` becomes:
```yaml
depends_on:
  - postgrest
  - gotrue
  - storage
```

Backend `depends_on` becomes:
```yaml
depends_on:
  postgres:
    condition: service_healthy
  gotrue:
    condition: service_started
```

Both services have `restart: always`, so if one starts before the other is ready, it will retry automatically.

### Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose build --no-cache backend
docker compose up -d
docker compose logs backend --tail=30 -f
```

