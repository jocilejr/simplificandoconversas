

## Problema

A URL de tracking gerada é:
```
https://app.chatbotsimplificado.com/functions/v1/link-redirect?code=xxx
```

O Nginx na VPS só tem `/functions/v1/` configurado no **API_DOMAIN**, não no **APP_DOMAIN**. Quando o WhatsApp busca essa URL no `APP_DOMAIN`, cai no `location /` que serve o React SPA (`index.html`) com as OG tags padrão do app — ignorando completamente os dados customizados de preview.

O bloco `/r/` no APP_DOMAIN já faz o proxy correto para o backend link-redirect. Basta mudar a URL gerada.

## Correção

Trocar a URL de tracking de `/functions/v1/link-redirect?code=XXX` para `/r/XXX` em 2 arquivos:

### 1. `deploy/backend/src/routes/execute-flow.ts`
- **Linha 466**: `${appUrl}/r/${shortCode}` (em vez de `/functions/v1/link-redirect?code=`)
- **Linha 522**: mesma mudança

### 2. `supabase/functions/execute-flow/index.ts`
- **Linha 763**: `${supabaseUrl}/r/${shortCode}` (na edge function, o SUPABASE_URL aponta para o API_DOMAIN, então precisa usar APP_URL ou manter o formato `/functions/v1/` que funciona no Lovable Cloud — vou verificar a variável correta)
- **Linha 893**: mesma mudança

Na edge function (Lovable Cloud), o formato `/functions/v1/link-redirect?code=` continua correto pois lá é o Supabase real. A mudança principal é no backend Express da VPS.

