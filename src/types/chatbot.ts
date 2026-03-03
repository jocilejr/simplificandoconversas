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
  | "action";

export interface FlowNodeData {
  label: string;
  type: FlowNodeType;
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
  simulateTyping?: boolean;
  // Wait for Reply
  replyVariable?: string;
  replyTimeout?: number;
  replyFallback?: string;
  // Action
  actionType?: "add_tag" | "remove_tag" | "add_to_list" | "set_variable";
  actionValue?: string;
  // Block attach
  attachedTo?: string;
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
    icon: "⚡",
    description: "Inicia o fluxo com uma palavra-chave ou evento",
  },
  sendText: {
    label: "Enviar Texto",
    color: "#3b82f6",
    icon: "💬",
    description: "Envia uma mensagem de texto",
  },
  sendAudio: {
    label: "Enviar Áudio",
    color: "#8b5cf6",
    icon: "🎤",
    description: "Envia áudio com simulação de gravação",
  },
  sendVideo: {
    label: "Enviar Vídeo",
    color: "#ec4899",
    icon: "🎥",
    description: "Envia um vídeo",
  },
  sendImage: {
    label: "Enviar Imagem",
    color: "#f59e0b",
    icon: "🖼️",
    description: "Envia uma imagem",
  },
  condition: {
    label: "Condição",
    color: "#ef4444",
    icon: "🔀",
    description: "Ramifica com base em condições",
  },
  randomizer: {
    label: "Randomizador",
    color: "#06b6d4",
    icon: "🎲",
    description: "Distribui aleatoriamente entre caminhos",
  },
  waitDelay: {
    label: "Aguardar",
    color: "#64748b",
    icon: "⏱️",
    description: "Pausa com simulação de digitando...",
  },
  waitForReply: {
    label: "Capturar Resposta",
    color: "#10b981",
    icon: "💭",
    description: "Aguarda e captura a mensagem do contato",
  },
  action: {
    label: "Ação",
    color: "#f97316",
    icon: "⚙️",
    description: "Executa uma ação (tag, lista, variável)",
  },
};
