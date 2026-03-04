## Plano: Sidebar Profissional + Configuracoes Reestruturadas com Gerenciamento de Instancias

### 1. Redesign da Sidebar

**Problemas atuais**: Visual generico, sem personalidade, footer com "API Conectada" estatico sem valor real.

**Solucao**:

- Logo mais sofisticado com tipografia refinada
- Items de menu com icones maiores (h-5 w-5), padding mais generoso, border-radius mais suave
- Badge de unread com estilo mais polido
- Footer com avatar do usuario logado + nome + botao de logout
- Remover o indicador "API Conectada" estatico
- Separador visual sutil entre grupos de menu
- Hover states mais refinados com transicao suave

### 2. Reestruturar Configuracoes com Tabs/Secoes

A pagina de configuracoes sera dividida em abas navegaveis:

- **Perfil**: Nome, avatar
- **Conexoes**: Gerenciamento de instancias Evolution API (principal mudanca)
- **Inteligencia Artificial**: API Key da OpenAI
- **Aplicacao**: URL publica, webhook

### 3. Gerenciamento de Instancias Evolution API (Secao Conexoes)

**Fluxo completo sem campo "nome da instancia" manual**:

a) O usuario informa apenas **URL Base** e **API Key Global** da Evolution API

b) A aplicacao busca as instancias ativas via `GET /instance/fetchInstances`

c) Lista as instancias com status (open/close/connecting) em cards visuais

d) Botao **"Criar Nova Instancia"** que:

- Chama `POST /instance/create` com nome auto-gerado
- Configura webhook automaticamente no body do create com URL do webhook da app e todos os eventos (MESSAGES_UPSERT, SEND_MESSAGE, CONTACTS_SET, CONTACTS_UPSERT, QRCODE_UPDATED, etc.)
- Exibe QR Code retornado para o usuario escanear

e) Botao **"Conectar"** em instancias desconectadas que chama `GET /instance/connect/{instance}` e exibe o QR Code

f) Campo opcional de **Proxy** por instancia

g) A instancia selecionada/ativa sera salva no perfil como `evolution_instance_name` (mantendo compatibilidade com o resto do sistema)

### 4. Mudancas no Banco de Dados

Nova tabela `evolution_instances` para suportar multiplas instancias:

```sql
CREATE TABLE public.evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  status text DEFAULT 'close',
  is_active boolean DEFAULT false,
  proxy_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, instance_name)
);
```

Manter campos `evolution_api_url` e `evolution_api_key` na tabela `profiles` (credenciais globais do servidor). O campo `evolution_instance_name` continua existindo para compatibilidade, mas sera preenchido automaticamente pela instancia ativa.

### 5. Novas Actions no Edge Function `evolution-proxy`

- `fetch-instances`: GET /instance/fetchInstances
- `create-instance`: POST /instance/create (com webhook auto-configurado)
- `connect-instance`: GET /instance/connect/{instance} (retorna QR code)
- `delete-instance`: DELETE /instance/delete/{instance}
- `set-proxy`: configura proxy na instancia

### Arquivos a criar/editar

- **Migration SQL**: tabela `evolution_instances` + RLS
- `src/components/AppSidebar.tsx`: redesign completo
- `src/pages/SettingsPage.tsx`: reestruturar com tabs
- `src/components/settings/ProfileSection.tsx`: secao de perfil
- `src/components/settings/ConnectionsSection.tsx`: gerenciamento de instancias
- `src/components/settings/AISection.tsx`: secao OpenAI
- `src/components/settings/AppSection.tsx`: URL publica + webhook
- `src/hooks/useEvolutionInstances.ts`: hook para CRUD de instancias
- `supabase/functions/evolution-proxy/index.ts`: novas actions
- `src/hooks/useProfile.ts`: ajustes para instancia ativa  
  
O chat deve conter as mensagens de TODAS as instancias conectadas, podendo selecionar individualmente