

## Plano: Lembretes, IA Auto-Resposta, Dashboard Real e Redesign

Este e um projeto grande. Vou dividir em 4 fases incrementais para entregar valor rapido sem quebrar nada.

---

### Fase 1: Tabela de Lembretes + CRUD no painel web + endpoint para extensao

**Banco de dados** — nova tabela `reminders`:
```sql
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text,
  contact_name text,
  phone_number text,
  title text NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reminders" ON public.reminders
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Frontend** — nova pagina `/reminders`:
- Lista de lembretes com filtros (pendentes / concluidos / atrasados)
- Formulario para criar lembrete associado a contato (nome, telefone, data, descricao)
- Badges visuais: vermelho para atrasados, amarelo para hoje, verde para futuros
- Rota adicionada no `App.tsx` e item no `AppSidebar`

**Backend (extensao)** — novos endpoints em `extension-api.ts`:
- `GET /api/ext/reminders` — lista lembretes do usuario
- `POST /api/ext/reminders` — criar lembrete a partir da sidebar
- `PATCH /api/ext/reminders/:id` — marcar como concluido
- Extensao Chrome exibe lembretes na aba de contato e permite criar novos

---

### Fase 2: Dashboard com dados reais

**Substituir dados mockados** no `Dashboard.tsx`:
- Hook `useDashboardStats` que consulta via backend `/api/ext/dashboard` (ja existe e retorna `activeFlows`, `totalContacts`, `runningExecutions`, `totalInstances`, `recentExecutions`)
- Cards de stats alimentados com dados reais
- Lista de "Atividade Recente" alimentada por `recentExecutions` do backend
- Indicador de lembretes pendentes para hoje
- Atalhos rapidos funcional (links para as paginas corretas)

---

### Fase 3: IA Auto-Resposta em tempo real

**Banco de dados** — nova tabela `ai_auto_reply_configs`:
```sql
CREATE TABLE public.ai_auto_reply_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT false,
  system_prompt text DEFAULT 'Voce e um assistente de vendas...',
  max_context_messages int DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, instance_name)
);
-- RLS similar
```

**Logica no webhook** (`webhook.ts`):
- Ao receber mensagem inbound, verificar se `ai_auto_reply_configs` esta ativo para aquela instancia
- Se ativo E nenhum fluxo em execucao para aquele contato:
  - Buscar ultimas N mensagens da conversa como contexto
  - Chamar OpenAI (usando chave do perfil do usuario) para gerar resposta
  - Enviar resposta via Evolution API
  - Salvar mensagem de resposta no banco

**Frontend** — nova secao em Settings ou pagina dedicada:
- Toggle de ativacao por instancia
- Editor de system prompt
- Configuracao de quantidade de mensagens de contexto

**Extensao** — indicador visual na sidebar mostrando que IA esta ativa para aquela instancia

---

### Fase 4: Redesign do Layout

**AppLayout / AppSidebar:**
- Sidebar com icones mais refinados e badges de notificacao (lembretes atrasados, fluxos ativos)
- Header com breadcrumb contextual e busca global

**Dashboard redesign:**
- Cards com micro-graficos (sparklines) usando dados de 7 dias
- Secao de lembretes do dia em destaque
- Grid responsivo melhorado com 3 colunas no desktop

**Paginas existentes:**
- Contatos: tabela real com dados do banco, busca funcional
- Agendamentos: integrar com lembretes

---

### Ordem de implementacao sugerida

Recomendo comecar pela **Fase 1 (Lembretes)** pois e autocontida, agrega valor imediato tanto no painel web quanto na extensao, e cria a base para as notificacoes do Dashboard.

Posso implementar fase por fase. Qual fase voce quer que eu comece?

