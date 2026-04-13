#!/usr/bin/env bash
# ============================================================
# sanitize-storage.sh — Limpeza cirúrgica de Docker + mídia
#
# Uso:
#   ./sanitize-storage.sh            → dry-run (mostra o que faria)
#   ./sanitize-storage.sh --execute  → executa de verdade
#
# SEGURO para VPS com múltiplas aplicações:
#   - NÃO usa "docker image prune -a"
#   - Remove apenas imagens específicas sem container ativo
#   - Trunca logs, não deleta
# ============================================================

set -euo pipefail

EXECUTE=false
[[ "${1:-}" == "--execute" ]] && EXECUTE=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }

echo ""
echo "=========================================="
if $EXECUTE; then
  echo -e "  ${RED}MODO: EXECUÇÃO REAL${NC}"
else
  echo -e "  ${YELLOW}MODO: DRY-RUN (simulação)${NC}"
  echo "  Use --execute para executar de verdade"
fi
echo "=========================================="
echo ""

# ── Disco antes ──
log "Disco ANTES da limpeza:"
df -h / | tail -1
echo ""

# ── 1. Imagens não utilizadas (remoção cirúrgica) ──
UNUSED_IMAGES=(
  "atendai/evolution-api:v2.2.3"
  "joseluisq/static-web-server:2-alpine"
)

for img in "${UNUSED_IMAGES[@]}"; do
  if docker image inspect "$img" &>/dev/null; then
    SIZE=$(docker image inspect "$img" --format='{{.Size}}' 2>/dev/null || echo "0")
    SIZE_MB=$((SIZE / 1024 / 1024))
    if $EXECUTE; then
      docker rmi "$img" 2>/dev/null && ok "Removida: $img (~${SIZE_MB} MB)" || warn "Não foi possível remover: $img (pode estar em uso)"
    else
      log "[DRY-RUN] Removeria: $img (~${SIZE_MB} MB)"
    fi
  else
    log "Imagem não encontrada (já removida?): $img"
  fi
done

# ── 2. Imagens dangling (sem tag, sem container) ──
DANGLING_COUNT=$(docker images -f "dangling=true" -q | wc -l)
if [ "$DANGLING_COUNT" -gt 0 ]; then
  if $EXECUTE; then
    docker image prune -f
    ok "Removidas $DANGLING_COUNT imagens dangling"
  else
    log "[DRY-RUN] Removeria $DANGLING_COUNT imagens dangling"
  fi
else
  log "Nenhuma imagem dangling encontrada"
fi

# ── 3. Build cache ──
CACHE_SIZE=$(docker system df --format '{{.Reclaimable}}' 2>/dev/null | tail -1 || echo "desconhecido")
if $EXECUTE; then
  docker builder prune -a -f
  ok "Build cache limpo"
else
  log "[DRY-RUN] Limparia build cache (reclaimável: $CACHE_SIZE)"
fi

# ── 4. Logs de containers > 50MB ──
log "Verificando logs grandes (> 50MB)..."
TOTAL_LOG_FREED=0
for LOG_FILE in $(find /var/lib/docker/containers -name "*.log" -size +50M 2>/dev/null); do
  LOG_SIZE=$(du -m "$LOG_FILE" 2>/dev/null | cut -f1)
  CONTAINER_ID=$(basename "$(dirname "$LOG_FILE")")
  CONTAINER_NAME=$(docker inspect --format='{{.Name}}' "$CONTAINER_ID" 2>/dev/null | sed 's|^/||' || echo "$CONTAINER_ID")
  
  if $EXECUTE; then
    truncate -s 0 "$LOG_FILE"
    ok "Log truncado: $CONTAINER_NAME (${LOG_SIZE} MB)"
  else
    log "[DRY-RUN] Truncaria log: $CONTAINER_NAME (${LOG_SIZE} MB)"
  fi
  TOTAL_LOG_FREED=$((TOTAL_LOG_FREED + LOG_SIZE))
done

if [ "$TOTAL_LOG_FREED" -eq 0 ]; then
  log "Nenhum log > 50MB encontrado"
else
  log "Total de logs: ~${TOTAL_LOG_FREED} MB"
fi

# ── 5. Mídia TEMPORÁRIA (boletos e tmp) ──
# IMPORTANTE: Nunca deletar arquivos fora de */boletos/* e */tmp/*
# Fluxos, campanhas de grupos, leads, área de membros = PERMANENTE
MEDIA_CONTAINER="deploy-backend-1"
if docker ps --format '{{.Names}}' | grep -q "$MEDIA_CONTAINER"; then

  # 5a. Boletos expirados > 30 dias (safety net)
  BOLETO_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -path "*/boletos/*" -type f -mtime +30 2>/dev/null | wc -l || echo "0")
  if [ "$BOLETO_COUNT" -gt 0 ]; then
    BOLETO_SIZE=$(docker exec "$MEDIA_CONTAINER" find /media-files -path "*/boletos/*" -type f -mtime +30 -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1 || echo "?")
    if $EXECUTE; then
      docker exec "$MEDIA_CONTAINER" find /media-files -path "*/boletos/*" -type f -mtime +30 -delete 2>/dev/null
      ok "Removidos $BOLETO_COUNT boletos expirados ($BOLETO_SIZE)"
    else
      log "[DRY-RUN] Removeria $BOLETO_COUNT boletos expirados ($BOLETO_SIZE)"
    fi
  else
    log "Nenhum boleto expirado > 30 dias"
  fi

  # 5b. Arquivos temporários (transcrições, downloads) > 1 dia
  TMP_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -path "*/tmp/*" -type f -mtime +1 2>/dev/null | wc -l || echo "0")
  if [ "$TMP_COUNT" -gt 0 ]; then
    TMP_SIZE=$(docker exec "$MEDIA_CONTAINER" find /media-files -path "*/tmp/*" -type f -mtime +1 -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1 || echo "?")
    if $EXECUTE; then
      docker exec "$MEDIA_CONTAINER" find /media-files -path "*/tmp/*" -type f -mtime +1 -delete 2>/dev/null
      ok "Removidos $TMP_COUNT arquivos temporários ($TMP_SIZE)"
    else
      log "[DRY-RUN] Removeria $TMP_COUNT arquivos temporários ($TMP_SIZE)"
    fi
  else
    log "Nenhum arquivo temporário > 1 dia"
  fi

  # 5c. Relatório de uso do armazenamento permanente (sem deletar)
  echo ""
  log "📊 Relatório de armazenamento permanente (NÃO será deletado):"
  TOTAL_SIZE=$(docker exec "$MEDIA_CONTAINER" du -sh /media-files 2>/dev/null | cut -f1 || echo "?")
  TOTAL_FILES=$(docker exec "$MEDIA_CONTAINER" find /media-files -type f 2>/dev/null | wc -l || echo "?")
  log "   Total: $TOTAL_SIZE em $TOTAL_FILES arquivos"
  AUDIO_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -type f \( -name "*.ogg" -o -name "*.mp3" -o -name "*.m4a" \) -not -path "*/tmp/*" -not -path "*/boletos/*" 2>/dev/null | wc -l || echo "0")
  IMAGE_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.webp" \) -not -path "*/tmp/*" -not -path "*/boletos/*" 2>/dev/null | wc -l || echo "0")
  VIDEO_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -type f \( -name "*.mp4" -o -name "*.webm" \) -not -path "*/tmp/*" -not -path "*/boletos/*" 2>/dev/null | wc -l || echo "0")
  PDF_COUNT=$(docker exec "$MEDIA_CONTAINER" find /media-files -type f -name "*.pdf" -not -path "*/tmp/*" -not -path "*/boletos/*" 2>/dev/null | wc -l || echo "0")
  log "   Permanentes: $AUDIO_COUNT áudios, $IMAGE_COUNT imagens, $VIDEO_COUNT vídeos, $PDF_COUNT PDFs"

else
  warn "Container $MEDIA_CONTAINER não está rodando, pulando limpeza de mídia"
fi

echo ""
# ── Disco depois ──
if $EXECUTE; then
  log "Disco DEPOIS da limpeza:"
  df -h / | tail -1
  echo ""
  ok "Limpeza concluída!"
else
  echo "=========================================="
  echo -e "  ${YELLOW}Nenhuma alteração foi feita (dry-run)${NC}"
  echo "  Execute com: ./sanitize-storage.sh --execute"
  echo "=========================================="
fi
