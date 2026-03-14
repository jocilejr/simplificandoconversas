

## Plano: Redesign da Extensao Chrome — Sidebar Profissional

### Conceito

Transformar o overlay atual (FAB + painel pequeno) em uma **sidebar fixa na direita** do WhatsApp Web, com layout profissional e duas abas: **Dashboard** (visao geral) e **Contato** (detalhes do contato aberto). A extensao detecta automaticamente qual instancia/numero esta sendo usada no WhatsApp Web, eliminando a necessidade de selecionar instancia manualmente.

### Arquitetura da Sidebar

```text
WhatsApp Web
├── Interface original (largura reduzida)
└── Sidebar SC (direita, ~360px)
    ├── Header (logo + status conexao)
    ├── Tab Bar: [Dashboard] [Contato]
    ├── Dashboard Tab:
    │   ├── Cards resumo (leads ativos, fluxos rodando, tarefas)
    │   ├── Atalhos rapidos (Meus Fluxos, Contatos, etc)
    │   └── Ultimos fluxos disparados
    └── Contato Tab (ativa ao abrir conversa):
        ├── Nome + Telefone + Avatar
        ├── Tags do contato
        ├── Fluxo ativo (com botao pausar)
        ├── Conversas em outros numeros (cross-instance)
        ├── Disparar fluxo (lista de fluxos)
        └── Historico de execucoes
```

### Deteccao Automatica da Instancia

O content script vai extrair o numero do proprio usuario logado no WhatsApp Web (visivel no menu de perfil ou no header). Esse numero e enviado ao backend que faz match com `whatsapp_instances.instance_name` para identificar qual instancia esta ativa, eliminando o seletor manual.

### Mudancas nos Arquivos

**Chrome Extension (reescrever):**
- `content.js` — Sidebar fixa ao inves de FAB/painel flutuante. Detecta instancia automaticamente. Duas abas (Dashboard/Contato). Sincroniza dados do contato com backend ao abrir conversa.
- `styles.css` — Layout completo da sidebar com design profissional escuro, cards, badges, tabs.
- `background.js` — Adicionar novas actions: `dashboard-stats`, `contact-cross-instances`, `detect-instance`.

**Backend (novo endpoint + alteracao):**
- `extension-api.ts` — Adicionar:
  - `GET /api/ext/dashboard` — Stats agregados (leads ativos, fluxos rodando, execucoes recentes)
  - `GET /api/ext/contact-cross?phone=X` — Conversas do mesmo telefone em todas as instancias
  - `GET /api/ext/detect-instance?phone=X` — Identifica instancia pelo numero do WhatsApp logado

**Sem alteracoes em:** `manifest.json`, `popup.html/js`, `nginx`, `index.ts`

### Design (inspirado na imagem 2)

- Fundo escuro (#111b21) consistente com o WhatsApp Web
- Cards com bordas arredondadas e fundo levemente mais claro (#1f2c34)
- Tipografia limpa, sem emojis, icones minimalistas via unicode/SVG inline
- Tab bar com indicador verde ativo
- Badges de status com cores semanticas (verde=ativo, amarelo=aguardando, cinza=inativo)
- Secao "Conversas em outros numeros" mostrando cards por instancia

