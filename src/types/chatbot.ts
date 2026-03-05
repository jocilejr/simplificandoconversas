import { type Node, type Edge } from "@xyflow/react";

export type FlowNodeType =
  | "trigger"
  | "sendText"
  | "sendAudio"
  | "sendVideo"
  | "sendImage"
  | "condition"
  | "randomizer"
  | "waitDelay"
  | "waitForReply"
  | "action"
  | "groupBlock"
  | "aiAgent"
  | "waitForClick";

export interface FlowStepData {
  id: string;
  data: FlowNodeData;
}

export interface FlowNodeData {
  label: string;
  type: FlowNodeType;
  // Group
  steps?: FlowStepData[];
  // Trigger
  triggerKeyword?: string;
  triggerType?: "keyword" | "any_message" | "event";
  // Send Text
  textContent?: string;
  // Send Audio
  audioUrl?: string;
  simulateRecording?: boolean;
  // Send Video/Image
  mediaUrl?: string;
  caption?: string;
  // Condition
  conditionField?: string;
  conditionOperator?: "equals" | "contains" | "starts_with" | "regex";
  conditionValue?: string;
  // Randomizer
  paths?: number;
  // Wait/Delay
  delaySeconds?: number;
  delayRandomMode?: boolean;
  delayMinSeconds?: number;
  delayMaxSeconds?: number;
  simulateTyping?: boolean;
  delayPresenceType?: "composing" | "recording";
  // Wait for Reply
  replyVariable?: string;
  replyTimeout?: number;
  replyTimeoutUnit?: "seconds" | "minutes" | "hours";
  replyFallback?: string;
  // Action
  actionType?: "add_tag" | "remove_tag" | "add_to_list" | "set_variable";
  actionValue?: string;
  // AI Agent
  aiSystemPrompt?: string;
  aiModel?: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";
  aiAcceptedMedia?: ("text" | "audio" | "image" | "pdf")[];
  aiResponseVariable?: string;
  aiAutoSend?: boolean;
  aiTemperature?: number;
  aiMaxTokens?: number;
  aiHistoryCount?: number;
  // Wait for Click
  clickUrl?: string;
  clickMessage?: string;
  clickTimeout?: number;
  clickTimeoutUnit?: "seconds" | "minutes" | "hours";
  clickPreviewTitle?: string;
  clickPreviewDescription?: string;
  clickPreviewImage?: string;
  // Dock indicator
  isDockTarget?: boolean;
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

// Helper: parse WhatsApp-style formatting to React elements
export function parseWhatsAppFormatting(text: string): string {
  return text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>');
}

export const nodeTypeConfig: Record<
  FlowNodeType,
  { label: string; color: string; icon: string; description: string }
> = {
  trigger: {
    label: "Gatilho",
    color: "#22c55e",
    icon: "Zap",
    description: "Inicia o fluxo com uma palavra-chave ou evento",
  },
  sendText: {
    label: "Enviar Texto",
    color: "#3b82f6",
    icon: "MessageSquare",
    description: "Envia uma mensagem de texto",
  },
  sendAudio: {
    label: "Enviar Áudio",
    color: "#8b5cf6",
    icon: "Mic",
    description: "Envia áudio com simulação de gravação",
  },
  sendVideo: {
    label: "Enviar Vídeo",
    color: "#ec4899",
    icon: "Video",
    description: "Envia um vídeo",
  },
  sendImage: {
    label: "Enviar Imagem",
    color: "#f59e0b",
    icon: "Image",
    description: "Envia uma imagem",
  },
  condition: {
    label: "Condição",
    color: "#ef4444",
    icon: "GitBranch",
    description: "Ramifica com base em condições",
  },
  randomizer: {
    label: "Randomizador",
    color: "#06b6d4",
    icon: "Shuffle",
    description: "Distribui aleatoriamente entre caminhos",
  },
  waitDelay: {
    label: "Aguardar",
    color: "#64748b",
    icon: "Timer",
    description: "Pausa com simulação de digitando...",
  },
  waitForReply: {
    label: "Capturar Resposta",
    color: "#10b981",
    icon: "MessageCircle",
    description: "Aguarda e captura a mensagem do contato",
  },
  action: {
    label: "Ação",
    color: "#f97316",
    icon: "Settings",
    description: "Executa uma ação (tag, lista, variável)",
  },
  groupBlock: {
    label: "Grupo",
    color: "#6b7280",
    icon: "Layers",
    description: "Grupo de passos empilhados",
  },
  aiAgent: {
    label: "Agente IA",
    color: "#a855f7",
    icon: "BrainCircuit",
    description: "Processa mensagens com OpenAI (texto, áudio, imagem, PDF)",
  },
  waitForClick: {
    label: "Aguardar Clique",
    color: "#0ea5e9",
    icon: "Link",
    description: "Envia link rastreável e aguarda o clique para continuar",
  },
};

export const defaultNodeData: Record<FlowNodeType, Partial<FlowNodeData>> = {
  trigger: { triggerType: "keyword", triggerKeyword: "" },
  sendText: { textContent: "" },
  sendAudio: { audioUrl: "", simulateRecording: false },
  sendVideo: { mediaUrl: "", caption: "" },
  sendImage: { mediaUrl: "", caption: "" },
  condition: { conditionField: "mensagem", conditionOperator: "contains", conditionValue: "" },
  randomizer: { paths: 2 },
  waitDelay: { delaySeconds: 3, simulateTyping: true, delayRandomMode: false, delayMinSeconds: 3, delayMaxSeconds: 9, delayPresenceType: "composing" },
  waitForReply: { replyVariable: "resposta", replyTimeout: 0, replyTimeoutUnit: "minutes", replyFallback: "" },
  action: { actionType: "add_tag", actionValue: "" },
  groupBlock: { steps: [] },
  aiAgent: {
    aiSystemPrompt: "",
    aiModel: "gpt-4o",
    aiAcceptedMedia: ["text", "audio", "image", "pdf"],
    aiResponseVariable: "resposta_ia",
    aiAutoSend: true,
    aiTemperature: 0.7,
    aiMaxTokens: 500,
    aiHistoryCount: 10,
  },
  waitForClick: {
    clickUrl: "",
    clickMessage: "Clique no link para continuar: {{link}}",
    clickTimeout: 0,
    clickTimeoutUnit: "minutes",
  },
};
