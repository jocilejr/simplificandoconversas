

## Diagnóstico

O container do backend **não foi reconstruído** na última atualização. No output do deploy, o backend aparece como `Running` (não `Started`), ou seja, está rodando a versão antiga sem os logs de debug.

Além disso, o Redis agora está online, mas precisamos confirmar que a Evolution API consegue gerar QR codes corretamente.

## Plano

### 1. Adicionar logging detalhado e delay no backend

No `deploy/backend/src/routes/whatsapp-proxy.ts`, no case `create-instance`:
- Adicionar `console.log` para registrar cada etapa (criação, connect, resultado final)
- Adicionar delay de 2 segundos entre create e connect para dar tempo à Evolution API
- Registrar erros do connect em vez de engolir silenciosamente

### 2. Deploy correto

Instruções para o usuário:
```bash
cd ~/simplificandoconversas/deploy
git pull origin main
docker compose up -d --build backend
# Testar criar instância, depois:
docker compose logs backend --tail=30
```

O `--build backend` é essencial — sem ele o container continua com o código antigo.

