

## Plano: Separar armazenamento permanente vs temporário e proteger dados

### Problema atual

O `sanitize-storage.sh` (seção 5, linhas 111-130) deleta **todos** os arquivos de mídia com mais de 30 dias em `/media-files/` sem verificar se estão sendo usados. Isso afeta:
- Áudios de fluxos de automação (permanentes)
- Mídias de campanhas de grupos (permanentes)
- Fotos/dados de leads (permanentes)
- Materiais da área de membros (permanentes)

### Arquitetura proposta

Separar o volume `/media-files/` em duas áreas lógicas:

```text
/media-files/{userId}/
  ├── boletos/          ← TEMPORÁRIO (já gerenciado pelo cron de boletos)
  ├── tmp/              ← TEMPORÁRIO (transcrições, downloads efêmeros)
  └── (demais arquivos) ← PERMANENTE (fluxos, grupos, membros, leads)
```

### Mudanças

| Arquivo | Ação |
|---|---|
| `deploy/sanitize-storage.sh` | Reescrever seção 5: só limpar arquivos dentro de subpastas `boletos/` e `tmp/`. Nunca tocar em arquivos fora dessas pastas. Adicionar seção 6 de relatório (listar tamanho de conteúdo permanente sem deletar) |
| `deploy/update.sh` | Adicionar backup automático do volume de mídia antes de cada deploy |
| `deploy/backend/src/index.ts` | O cron de boletos já está correto (só deleta boletos pendentes >30d). Sem mudanças necessárias |

### Detalhes da seção 5 reescrita (`sanitize-storage.sh`)

A nova lógica será:

1. **Boletos expirados** (>30 dias em `*/boletos/`): deletar (o cron do backend já faz isso, mas como safety net)
2. **Arquivos temporários** (qualquer coisa em `*/tmp/` com >1 dia): deletar
3. **Todo o resto**: NÃO TOCAR — mostrar apenas o tamanho total como relatório

```bash
# Seção 5: Limpar APENAS arquivos temporários
# Boletos pendentes > 30 dias (safety net — o cron do backend já faz isso)
docker exec "$MEDIA_CONTAINER" find /media-files -path "*/boletos/*" -type f -mtime +30 ...

# Downloads temporários > 1 dia
docker exec "$MEDIA_CONTAINER" find /media-files -path "*/tmp/*" -type f -mtime +1 ...

# Seção 6: Relatório de uso (sem deletar)
docker exec "$MEDIA_CONTAINER" du -sh /media-files/
```

### Backup automático no `deploy/update.sh`

Adicionar entre o passo 1 (git pull) e o passo 2 (migrations):

```bash
echo "[1.5/5] Backing up media files..."
BACKUP_DIR="/root/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/media-$(date +%Y%m%d-%H%M%S).tar.gz"
docker exec deploy-backend-1 tar czf - /media-files 2>/dev/null > "$BACKUP_FILE" && \
  echo "   → Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" || \
  echo "   → Aviso: backup falhou (continuando deploy)"
ls -t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
```

### Resultado esperado
- Arquivos de fluxos, campanhas, leads e membros **nunca** serão deletados pela sanitização
- Apenas boletos expirados e arquivos em `*/tmp/` são removidos
- Cada deploy cria backup do volume de mídia (mantendo os 5 mais recentes)
- Relatório de uso do disco permanente visível no dry-run

