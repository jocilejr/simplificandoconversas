

## Diagnóstico

O problema é um **bug conhecido** na Evolution API v2.2.3. O endpoint `/instance/connect/{name}` sempre retorna `{"count": 0}` sem o QR code base64 — causado por um loop infinito de reconexão que impede a geração do QR.

Referência: [GitHub Issue #2430](https://github.com/EvolutionAPI/evolution-api/issues/2430) e [PR #2365](https://github.com/EvolutionAPI/evolution-api/pull/2365)

**Versões afetadas:** v2.1.0, v2.1.1, v2.2.0, v2.2.3
**Correção disponível em:** v2.3.7+

## Plano

### 1. Atualizar Evolution API para v2.3.7

No `deploy/docker-compose.yml`, linha 125:
```yaml
# DE:
image: atendai/evolution-api:v2.2.3

# PARA:
image: atendai/evolution-api:v2.3.7
```

### 2. Adicionar feedback no frontend quando QR não é retornado

No `src/components/settings/ConnectionsSection.tsx`, na função `handleGetQrCode`, adicionar um toast informando quando o QR code não foi gerado, em vez de silenciosamente ignorar.

### 3. Deploy na VPS

```bash
cd ~/simplificandoconversas/deploy
git pull origin main
docker compose pull evolution
docker compose up -d evolution
# Aguardar ~30s para o container iniciar
docker compose up -d --build backend
# Testar criando instância e gerando QR:
docker compose logs evolution --tail=20
```

## Detalhes Técnicos

A Evolution API v2.2.3 tem um bug no handler `connectionUpdate` do Baileys que dispara reconexão imediata quando a conexão fecha durante a geração inicial do QR code. Isso cria um loop infinito onde o QR nunca é gerado (`count` sempre 0). A v2.3.7 corrige isso verificando se é uma conexão inicial antes de reconectar.

