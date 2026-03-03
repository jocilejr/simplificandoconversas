

## Sistema de Automação de Mensagens com Evolution API

### 1. Autenticação e Perfis de Usuário
- Tela de login/cadastro com email e senha
- Tabela de perfis com nome, avatar e preferências
- Área de configuração da conta

### 2. Dashboard Principal
- Visão geral com métricas: mensagens enviadas, contatos ativos, fluxos ativos
- Gráficos de atividade recente
- Atalhos rápidos para as principais funcionalidades

### 3. Configuração da Evolution API
- Tela de configurações para inserir URL base e API Key da instância
- Teste de conexão com a API
- Status da instância (conectada/desconectada, QR Code se necessário)

### 4. Gerenciamento de Contatos
- Lista de contatos com busca e filtros
- Importação de contatos (CSV)
- Criação de grupos/listas de segmentação
- Tags para organizar contatos
- Detalhes do contato com histórico de mensagens

### 5. Agendamento de Mensagens
- Calendário visual para agendar envios
- Agendamento individual ou para listas de contatos
- Suporte a texto, imagem, áudio e vídeo
- Histórico de mensagens agendadas (pendentes, enviadas, falhas)

### 6. Construtor Visual de Chatbot (Drag & Drop)
- **Canvas visual** com grid onde os nós do fluxo são posicionados por arrastar e soltar
- **Tipos de nós disponíveis:**
  - **Gatilho**: palavra-chave, mensagem recebida, evento específico
  - **Envio de Texto**: mensagem com variáveis dinâmicas (ex: {{nome}})
  - **Envio de Áudio**: upload de áudio ou gravação, com opção "simular gravando na hora"
  - **Envio de Vídeo**: upload e envio de vídeo
  - **Envio de Imagem**: upload e envio de imagem
  - **Condição (If/Else)**: ramificação baseada em palavras-chave, variáveis ou respostas do usuário
  - **Randomizador**: distribui aleatoriamente entre caminhos diferentes (ex: teste A/B)
  - **Wait / Delay**: pausa com simulação de "digitando..." antes de enviar a próxima mensagem
  - **Ação**: marcar tag, adicionar a lista, definir variável
- **Conexões visuais** entre nós com linhas/setas arrastáveis
- **Painel de propriedades** lateral para configurar cada nó selecionado
- **Salvar, ativar e desativar** fluxos

### 7. Visualizador de Chat em Tempo Real
- Painel tipo WhatsApp mostrando conversas em andamento
- Atualização em tempo real das mensagens enviadas e recebidas
- Indicadores de status (enviado, entregue, lido)
- Possibilidade de intervir manualmente na conversa

### 8. Backend (Lovable Cloud + Supabase)
- Edge functions para proxy seguro com a Evolution API
- Tabelas: profiles, contacts, contact_tags, groups, scheduled_messages, chatbot_flows, flow_nodes, flow_connections, conversations, messages
- Webhook endpoint para receber mensagens da Evolution API em tempo real
- Cron jobs para disparar mensagens agendadas

### 9. Design e UX
- Interface moderna e escura (tema dark)
- Sidebar com navegação: Dashboard, Contatos, Agendamentos, Chatbot Builder, Conversas, Configurações
- Design responsivo para desktop (foco principal)

