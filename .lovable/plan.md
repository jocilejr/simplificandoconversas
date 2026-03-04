

## Plano: Corrigir waitForClick — Bot Detection, URL e Preview

### Problemas identificados (dados do banco)

- Link criado às `16:26:22`, marcado como clicado às `16:26:25` (3 segundos) — claramente um bot/preview do WhatsApp
- `app_public_url` está `NULL` no perfil — URL do edge function é usada diretamente
- A rota SPA `/r/:code` não serve meta tags OG para crawlers (não executam JavaScript)

### Correções

#### 1. Proteção temporal anti-bot no `link-redirect`

Além da detecção por User-Agent, adicionar regra: **qualquer clique nos primeiros 15 segundos após a criação do link é ignorado como bot**. WhatsApp faz preview quase instantaneamente. Humanos levam mais tempo para ler a mensagem e clicar.

```
Se (agora - link.created_at) < 15 segundos → tratar como bot
```

#### 2. Sempre usar URL do edge function como link de tracking

A rota SPA `/r/:code` **não funciona** para previews OG porque crawlers não executam JavaScript. A solução correta é usar sempre a URL do edge function (`/functions/v1/link-redirect?code=xxx`), que já serve HTML com OG tags para bots e faz redirect para humanos.

Remover a lógica de `app_public_url` do `execute-flow` — o link de tracking deve sempre ser o edge function.

#### 3. Melhorar detecção de bots no `link-redirect`

Expandir os padrões de User-Agent e combinar com a proteção temporal:
- Se User-Agent contém padrões de bot → servir OG HTML
- Se clique < 15s da criação → servir OG HTML e NÃO marcar como clicado
- Somente clique real (humano, >15s) marca como clicado e retoma o fluxo

#### 4. Remover campo "URL do App" desnecessário

Remover o card "URL Pública do App" do `SettingsPage.tsx` e o campo `app_public_url` da lógica, já que não será mais utilizado.

### Arquivos editados

- `supabase/functions/link-redirect/index.ts` — proteção temporal + melhor bot detection
- `supabase/functions/execute-flow/index.ts` — remover lógica app_public_url, sempre usar edge function URL
- `src/pages/SettingsPage.tsx` — remover card URL do App

