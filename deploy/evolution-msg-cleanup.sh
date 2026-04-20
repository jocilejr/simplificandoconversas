#!/bin/bash
# Fix: Baileys msg retry bug — apaga mensagens fromMe > 1h da tabela evolution.Message
# E também limpa Redis baileys retry keys para prevenir reenvio após reconexão.
# Roda no HOST, independente de atualizacoes do container Evolution.

LOG=/var/log/evolution-msg-cleanup.log

# ─── PostgreSQL cleanup ───
PG_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^simplificando_postgres\.' | head -1)

if [ -z "$PG_CONTAINER" ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERRO: container simplificando_postgres nao encontrado" >> $LOG
    exit 1
fi

RESULT=$(docker exec "$PG_CONTAINER" psql -U postgres -d evolution -t -c \
    "DELETE FROM \"Message\" WHERE (key->>'fromMe')::boolean = true AND \"messageTimestamp\" < EXTRACT(EPOCH FROM NOW()) - 3600;" \
    2>/dev/null)

DELETED=$(echo "$RESULT" | grep -oP '(?<=DELETE )\d+')
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] DB: Deletadas ${DELETED:-0} mensagens fromMe antigas (container: $PG_CONTAINER)" >> $LOG

# ─── Redis baileys retry keys cleanup ───
# Formato: evolution:baileys:<instanceId>_<msgId>_<count>
# Instância que envia para grupos: a13598fd-2901-4198-a52c-505c2df36959 (Rosana Grupos Backup)
REDIS_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'simplificando_redis' | head -1)

if [ -z "$REDIS_CONTAINER" ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARN: container simplificando_redis nao encontrado" >> $LOG
else
    # Conta e deleta todas as baileys retry keys (todas as instâncias)
    REDIS_KEYS=$(docker exec "$REDIS_CONTAINER" redis-cli KEYS 'evolution:baileys:*-*-*-*-*_*_[0-9]*' 2>/dev/null)
    REDIS_COUNT=0
    if [ -n "$REDIS_KEYS" ]; then
        REDIS_COUNT=$(echo "$REDIS_KEYS" | wc -l | tr -d ' ')
        echo "$REDIS_KEYS" | while IFS= read -r key; do
            [ -n "$key" ] && docker exec "$REDIS_CONTAINER" redis-cli DEL "$key" > /dev/null 2>&1
        done
    fi
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Redis: Deletadas ${REDIS_COUNT} baileys retry keys" >> $LOG
fi
