

# Plano: Tornar `instance` obrigatório nos endpoints de envio

## Problema
Os endpoints `send-message` e `send-media` auto-selecionam a primeira instância ativa quando `instance` não é informado. O usuário precisa escolher qual instância usar.

## Alterações

### 1. Backend: `deploy/backend/src/routes/platform-api.ts`

**`POST /send-message`** (linha 574):
- Adicionar `instance` ao destructuring do body
- Tornar `instance` obrigatório — retornar 400 se não informado
- Usar `instance` direto como `instanceName` em vez de buscar no banco

**`POST /send-media`** (linha 701):
- Já recebe `instance` no body, mas faz fallback automático
- Tornar obrigatório — remover o bloco de fallback que busca instância ativa

**`POST /validate-number`** (linha 809):
- Adicionar `instance` ao body como obrigatório
- Remover busca automática de instância ativa

### 2. Frontend: `src/components/settings/IntegrationApiSection.tsx`
- Atualizar a documentação para mostrar `instance` como campo obrigatório nos 3 endpoints

### Resultado
Todos os endpoints de envio exigem `instance` no body, permitindo escolher qual instância WhatsApp usar.

