

## Diagnóstico

Dois pontos a resolver:

### 1. Auto-preenchimento de URLs (App + API)
Hoje em `src/components/settings/AppSection.tsx` o usuário precisa digitar manualmente:
- `app_public_url` (salvo em `profiles`)
- `api_public_url` (salvo em `workspaces`)

**Problema**: na VPS, ambos os domínios já estão definidos como variáveis de ambiente do build (`APP_DOMAIN` / `API_DOMAIN`) e expostos em runtime via `VITE_SUPABASE_URL` (que aponta para o `API_DOMAIN`). O `APP_DOMAIN` pode ser detectado via `window.location.origin`.

**Solução**: remover os inputs editáveis e mostrar apenas display read-only com auto-detecção:
- **App URL** = `window.location.origin`
- **API URL** = `import.meta.env.VITE_SUPABASE_URL` (já é o `API_DOMAIN` na VPS)

Persistir automaticamente no banco no primeiro load (se vazio ou diferente), via `useEffect`. Sem botão "Salvar", sem campo editável.

### 2. ID da instância na seção "Endpoints Disponíveis (VPS)"
Na imagem, os endpoints listados (`/api/platform/send-message`, `/send-media`, `/validate-number`) já mencionam que `instance` é obrigatório, mas **não mostram qual é a instância do workspace**. O usuário precisa saber/copiar o nome da instância para usar nas requisições externas.

**Solução**: em `IntegrationApiSection.tsx` (onde estão esses endpoints documentados), adicionar:
- Listar as instâncias do workspace (via `useWhatsAppInstances`)
- Para cada endpoint, mostrar exemplo de payload com a instância real preenchida (com botão copiar)
- Se houver múltiplas, dropdown/select para escolher qual instância usar nos exemplos

## Arquivos a alterar

- **`src/components/settings/AppSection.tsx`**
  - Remover inputs editáveis de App URL e API URL
  - Auto-detectar via `window.location.origin` e `import.meta.env.VITE_SUPABASE_URL`
  - Display read-only com botão copiar
  - `useEffect` que persiste no banco se valor mudou (silencioso, sem toast)

- **`src/components/settings/IntegrationApiSection.tsx`** (preciso ler primeiro para confirmar estrutura)
  - Buscar instâncias do workspace
  - Exibir nome(s) da instância em destaque na seção "Endpoints Disponíveis"
  - Exemplos de payload com instância pré-preenchida + botão copiar

## Validação na VPS (após deploy)

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh
```

Depois abrir Configurações → seção App: ver URLs auto-preenchidas. Abrir Integração API: ver instância(s) listadas nos exemplos de endpoint.

## Risco

Baixo. Auto-persist é idempotente (só grava se mudou). Display de instância é leitura.

