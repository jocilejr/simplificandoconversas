

## Diagnosis

Two problems found in the logs:

### 1. Evolution API: Redis not available
The Evolution API is configured to use Redis for caching (default in v2.2.3), but there is **no Redis container** in the docker-compose. This causes constant `redis disconnected` errors every second, which likely prevents instance creation and QR code generation from working properly.

### 2. No backend create-instance logs visible
The backend logs only show `check-timeouts` errors and no instance creation logs. This means either:
- The user tested from the Lovable preview URL (which returns 503 as expected)
- Or the request reached the backend but the Evolution API failed silently due to Redis issues

## Fix Plan

### Add Redis container to `deploy/docker-compose.yml`

Add a Redis service and configure Evolution API to use it:

```yaml
# Add Redis service
redis:
  image: redis:7-alpine
  restart: always
  volumes:
    - chatbot_redis:/data

# Add to Evolution API environment
CACHE_REDIS_ENABLED: "true"
CACHE_REDIS_URI: redis://redis:6379
CACHE_REDIS_PREFIX_KEY: evolution

# Add redis dependency
depends_on:
  - redis
```

Add `chatbot_redis` to the volumes section.

### Fix backend check-timeouts errors

The `check-timeouts` route is failing on every cron tick. This is a secondary issue but should also be investigated — likely the PostgREST URL or auth configuration in the service client.

### Deployment

After changes, on VPS:
```bash
cd ~/simplificandoconversas/deploy
git pull origin main
docker compose up -d --build
```

Then test creating an instance **from the VPS domain** (not the Lovable preview URL).

