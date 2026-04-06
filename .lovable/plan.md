

# Sistema de rastreamento de cliques em links de e-mail

## O que será feito

Reescrever todos os links (`<a href="...">`) no HTML dos e-mails antes do envio, redirecionando-os através de um endpoint de tracking. Quando o destinatário clica, o sistema registra quem clicou, qual link, e quando — depois redireciona para o destino original.

## Arquitetura

```text
E-mail enviado:
  <a href="https://seusite.com/oferta">  
  →  
  <a href="https://API_DOMAIN/api/email/click/CLICK_ID">

Destinatário clica → Backend registra → Redireciona 302 → seusite.com/oferta
```

## Alterações

### 1. Nova tabela `email_link_clicks` (migration)

```sql
CREATE TABLE email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL,
  user_id uuid NOT NULL,
  original_url text NOT NULL,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE email_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own link clicks" ON email_link_clicks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### 2. Backend — `deploy/backend/src/routes/email.ts`

- **Nova função `rewriteLinks(html, sendId, userId, baseUrl)`**: Usa regex para encontrar todos os `href="..."` no HTML, cria um registro em `email_link_clicks` para cada URL única, e substitui o href pelo URL de tracking
- **Novo endpoint `GET /api/email/click/:clickId`**: Busca o registro, marca como clicado (`clicked=true`, `clicked_at`), registra evento em `email_events`, e redireciona 302 para a URL original
- **Integrar `rewriteLinks`** nas funções de envio (`/send`, `/campaign`, webhook `send_email`) — chamado junto com `injectTrackingPixel`

### 3. Frontend — Visualização de cliques

- **`src/components/email/EmailHistoryTab.tsx`**: Adicionar coluna "Cliques" na tabela de histórico, mostrando a contagem de links clicados por envio
- **Dialog de detalhes**: Ao clicar na contagem, abrir um dialog mostrando cada link clicado (URL, data/hora do clique)
- **`src/hooks/useEmailSends.ts`**: Incluir contagem de cliques na query (subquery ou join com `email_link_clicks`)

### 4. Stats — Atualizar métricas

- **`GET /api/email/stats`**: Adicionar campo `clicked` (contagem de sends com pelo menos 1 clique) e `clickRate`
- **`src/pages/EmailPage.tsx`**: Adicionar card "Cliques" e "Taxa de Cliques" nos stats do dashboard

## Fluxo completo

1. E-mail é montado com HTML do template
2. `rewriteLinks()` encontra todos os `<a href>`, cria registros em `email_link_clicks`, reescreve URLs
3. `injectTrackingPixel()` adiciona pixel de abertura (já existente)
4. E-mail é enviado via SMTP
5. Destinatário abre → pixel registra abertura
6. Destinatário clica link → `/api/email/click/:id` registra clique → redireciona
7. Dashboard mostra aberturas e cliques por destinatário

