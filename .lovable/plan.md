

# Atualizar campos do Mercado Pago na Integração

## Problema
A tela de integração só pede **Access Token**, mas o Mercado Pago fornece 4 credenciais: **Public Key**, **Access Token**, **Client ID** e **Client Secret**.

## O que será feito

### 1. Atualizar `src/components/settings/IntegrationsSection.tsx`
Adicionar os 4 campos na config do Mercado Pago:

| Campo | Key | Obrigatório |
|---|---|---|
| Public Key | `public_key` | Não |
| Access Token | `access_token` | Sim |
| Client ID | `client_id` | Não |
| Client Secret | `client_secret` | Não |

Apenas o `access_token` é obrigatório (é o único usado pelo webhook para buscar pagamentos na API). Os outros são úteis para funcionalidades futuras (criar cobranças, etc.).

### 2. Nenhuma alteração no backend
O `webhook-transactions.ts` já usa apenas `credentials.access_token`, então não precisa de mudança.

## Arquivo modificado

| Arquivo | Alteração |
|---|---|
| `src/components/settings/IntegrationsSection.tsx` | Adicionar campos `public_key`, `client_id`, `client_secret` na config do Mercado Pago |

