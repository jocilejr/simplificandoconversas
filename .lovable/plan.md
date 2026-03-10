

## Root Cause Found: supabase-js URL Path Mismatch

The `check-timeouts` error with all `undefined` properties is caused by a fundamental URL mismatch:

- The backend sets `SUPABASE_URL=http://postgrest:3000`
- The `supabase-js` client automatically appends `/rest/v1/` to this URL
- So requests go to `http://postgrest:3000/rest/v1/flow_timeouts`
- But raw PostgREST serves at `http://postgrest:3000/flow_timeouts` (no prefix)
- PostgREST returns a 404/error that supabase-js can't parse → all `undefined` properties

This also means ALL database operations from the backend (upserts in sync-chats, etc.) are silently failing too.

The nginx config already handles this mapping: `/rest/v1/` → `http://postgrest:3000/`. The fix is to route backend requests through nginx.

## Changes

### 1. Update nginx to accept internal hostnames
In `deploy/nginx/default.conf.template`, change the API server block's `server_name` to also accept internal Docker hostnames:
```
server_name ${API_DOMAIN} nginx localhost;
```

### 2. Update docker-compose backend SUPABASE_URL
In `deploy/docker-compose.yml` (and `deploy/portainer-stack.yml`), change the backend's `SUPABASE_URL` from `http://postgrest:3000` to `http://nginx:80`:
```yaml
SUPABASE_URL: http://nginx:80
```

Also add `nginx` to the backend's `depends_on` list.

### 3. Update check-timeouts with better raw error capture
Add a try/catch and log the full error object using `Object.getOwnPropertyNames` to capture any non-enumerable properties if the fix doesn't resolve it.

## Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d nginx && docker compose build --no-cache backend && docker compose up -d backend
docker compose logs backend --tail=30 -f
```

