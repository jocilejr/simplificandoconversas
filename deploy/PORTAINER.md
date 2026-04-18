# Deploy via Portainer

Guia passo a passo para deploy usando **Portainer Stacks** com repositório Git.

---

## Pré-requisitos

- Portainer CE/BE instalado e funcionando
- Docker Engine no host
- Acesso ao repositório Git (público ou com credenciais)
- Node.js 20+ no host (para buildar o frontend)

---

## Passo 1 — Gerar Secrets

No terminal do servidor, gere os secrets necessários:

```bash
# JWT Secret
openssl rand -hex 32

# Postgres Password
openssl rand -hex 16

# Baileys Gateway API Key
openssl rand -hex 16
```

Para gerar `ANON_KEY` e `SERVICE_ROLE_KEY` (JWTs com roles `anon` e `service_role`):

```bash
# Substitua YOUR_JWT_SECRET pelo valor gerado acima
node -e "
const crypto = require('crypto');
const secret = 'YOUR_JWT_SECRET';
function makeJwt(role) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:'supabase',ref:'local',role,
    iat:Math.floor(Date.now()/1000),
    exp:Math.floor(Date.now()/1000)+315360000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}
console.log('ANON_KEY=' + makeJwt('anon'));
console.log('SERVICE_ROLE_KEY=' + makeJwt('service_role'));
"
```

---

## Passo 2 — Buildar o Frontend

O frontend precisa ser buildado e colocado em um volume Docker:

```bash
# Clone o repositório
git clone <SEU_REPO_URL> app && cd app

# Crie o .env de produção
cat > .env.production << EOF
VITE_SUPABASE_URL=http://SEU_IP_OU_DOMINIO
VITE_SUPABASE_PUBLISHABLE_KEY=SEU_ANON_KEY
VITE_SUPABASE_PROJECT_ID=local
EOF

# Instale dependências e builde
npm ci && npm run build

# Crie o volume e copie os arquivos
docker volume create simplificando_frontend
docker run --rm -v simplificando_frontend:/data -v $(pwd)/dist:/src alpine sh -c "cp -r /src/* /data/"
```

> **Nota:** O nome do volume deve corresponder ao `STACK_NAME` configurado no Portainer. O padrão é `simplificando_frontend`.

---

## Passo 3 — Criar a Stack no Portainer

1. Acesse o Portainer → **Stacks** → **Add Stack**
2. Escolha **Repository**
3. Configure:
   - **Repository URL:** `https://github.com/SEU_USUARIO/SEU_REPO.git`
   - **Reference:** `main` (ou sua branch)
   - **Compose path:** `deploy/portainer-stack.yml`
   - Se o repo for privado, configure as credenciais Git

4. Em **Environment Variables**, adicione:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `POSTGRES_PASSWORD` | *(gerado no passo 1)* | ✅ |
| `JWT_SECRET` | *(gerado no passo 1)* | ✅ |
| `ANON_KEY` | *(gerado no passo 1)* | ✅ |
| `SERVICE_ROLE_KEY` | *(gerado no passo 1)* | ✅ |
| `APP_URL` | `http://SEU_IP` ou `https://seudominio.com` | ✅ |
| `BAILEYS_API_KEY` | *(gerado no passo 1)* | ✅ |
| `STACK_NAME` | `simplificando` | ✅ |
| `OPENAI_API_KEY` | *(sua chave OpenAI)* | ❌ |

5. Clique em **Deploy the stack**

---

## Passo 4 — Verificar

Após o deploy, verifique se todos os containers estão **running** no Portainer.

Acesse `http://SEU_IP` no navegador — o sistema deve estar funcionando.

---

## Atualizando

### Frontend
Repita o **Passo 2** (build + copiar para o volume) e reinicie o container Nginx pelo Portainer.

### Backend / Baileys Gateway
No Portainer, vá na Stack e clique em **Pull and redeploy** para puxar as mudanças do Git e rebuildar.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Containers reiniciando | Verifique os logs no Portainer (clique no container → Logs) |
| Erro de conexão ao banco | Confirme que o `POSTGRES_PASSWORD` é o mesmo em todos os serviços |
| Frontend em branco | Verifique se o volume `frontend_data` foi populado corretamente |
| QR Code não aparece | Verifique os logs do container `baileys-gateway` |
| Erro 502 no Nginx | Aguarde alguns segundos para os serviços iniciarem |

---

## Arquitetura

```
Nginx (:80)
  ├── /              → Frontend (volume estático)
  ├── /rest/v1/      → PostgREST (API do banco)
  ├── /auth/v1/      → GoTrue (autenticação)
  ├── /storage/v1/   → Supabase Storage
  └── /functions/v1/ → Backend Express
                         └── (interno) → Baileys Gateway (WhatsApp)
```
