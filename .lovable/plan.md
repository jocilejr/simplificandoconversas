

## Diagnostico

Os logs confirmam que:
- Upload no filesystem: **OK** (`Media uploaded: success`)
- Insert no banco: **OK** (sem erro logado, `mediaUrl` preenchido)
- Frontend busca mensagens: **OK** (bolhas aparecem no chat)

O problema: as bolhas de midia aparecem como retangulos coloridos vazios. Isso significa que a tag `<img src="https://api.chatbotsimplificado.com/media/...">` nao consegue carregar a imagem. Possíveis causas:
1. Nginx nao esta servindo os arquivos (volume nao montado corretamente ou restart necessario)
2. CORS bloqueando (improvavel para `<img>`, mas possivel com certas configs)

## Plano

### 1. Frontend: Adicionar fallback visual para imagens com erro (`ChatPanel.tsx`)

Adicionar `onError` na tag `<img>` para mostrar um placeholder clicavel quando a imagem falha, em vez de um retangulo vazio:

```tsx
<img
  src={msg.media_url}
  alt=""
  className="..."
  onError={(e) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  }}
/>
<div className="hidden rounded-xl bg-white/10 p-4 text-xs text-white/60 flex items-center gap-2">
  📷 Imagem indisponível
</div>
```

### 2. Nginx: Permitir CORS aberto para midia (`default.conf.template`)

Trocar `$cors_origin` por `*` no bloco `/media/` para garantir que qualquer origem possa carregar as imagens:

```nginx
location /media/ {
    alias /usr/share/nginx/media/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header 'Access-Control-Allow-Origin' '*' always;
}
```

### 3. Instrucoes de deploy

Apos o deploy, o usuario deve verificar:
- Acessar a URL da midia diretamente no navegador para confirmar se o Nginx serve o arquivo
- Se retornar 404, o volume `chatbot_media` precisa de `docker compose down && docker compose up -d` (restart simples nao recria volumes)

