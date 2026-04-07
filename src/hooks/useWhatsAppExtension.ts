import { useState, useEffect, useCallback, useRef } from "react";

type ExtensionStatus = "connected" | "disconnected" | "checking";

function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  // Add Brazil country code if missing
  if (clean.length <= 11 && !clean.startsWith("55")) {
    clean = "55" + clean;
  }
  return clean;
}

export function useWhatsAppExtension() {
  const [status, setStatus] = useState<ExtensionStatus>("checking");
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResponse = useRef<number>(0);

  // ── Listen for responses from extension ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Extension is loaded on this page
      if (
        data.type === "WHATSAPP_EXTENSION_READY" ||
        data.type === "WHATSAPP_EXTENSION_LOADED"
      ) {
        lastResponse.current = Date.now();
        setStatus("connected");
      }

      // WhatsApp tab connection status
      if (data.type === "WHATSAPP_CONNECTION_STATUS") {
        setWhatsappConnected(data.connected);
      }

      // Command response
      if (data.type === "WHATSAPP_RESPONSE") {
        lastResponse.current = Date.now();
      }
    };

    window.addEventListener("message", handler);

    // Ping loop
    const doPing = () => {
      window.postMessage({ type: "WHATSAPP_EXTENSION_PING" }, "*");
    };
    doPing();
    pingInterval.current = setInterval(doPing, 5000);

    // Check if extension responded after first ping
    const initialCheck = setTimeout(() => {
      if (Date.now() - lastResponse.current > 4000) {
        setStatus("disconnected");
      }
    }, 3000);

    return () => {
      window.removeEventListener("message", handler);
      if (pingInterval.current) clearInterval(pingInterval.current);
      clearTimeout(initialCheck);
    };
  }, []);

  // ── Send command with multi-protocol envelope ──
  const sendCommand = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      const requestId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Primary format
      window.postMessage({ type: `WHATSAPP_${type}`, requestId, ...payload }, "*");
      // Envelope format
      window.postMessage(
        { type: "WHATSAPP_EXTENSION_COMMAND", command: type, requestId, ...payload },
        "*"
      );
      // Bare format (fallback)
      window.postMessage({ type, requestId, ...payload }, "*");

      return requestId;
    },
    []
  );

  const openChat = useCallback(
    (phone: string) => {
      const cleanPhone = normalizePhone(phone);
      return sendCommand("OPEN_CHAT", { phone: cleanPhone });
    },
    [sendCommand]
  );

  const sendText = useCallback(
    (phone: string, text: string) => {
      const cleanPhone = normalizePhone(phone);
      return sendCommand("SEND_TEXT", { phone: cleanPhone, text });
    },
    [sendCommand]
  );

  const sendImage = useCallback(
    (phone: string, imageDataUrl: string) => {
      const cleanPhone = normalizePhone(phone);
      return sendCommand("SEND_IMAGE", { phone: cleanPhone, imageDataUrl });
    },
    [sendCommand]
  );

  const fallbackOpenWhatsApp = useCallback((phone: string) => {
    const cleanPhone = normalizePhone(phone);
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  }, []);

  const retryConnection = useCallback(() => {
    setStatus("checking");
    window.postMessage({ type: "WHATSAPP_EXTENSION_PING" }, "*");
    setTimeout(() => {
      if (Date.now() - lastResponse.current > 4000) {
        setStatus("disconnected");
      }
    }, 3000);
  }, []);

  return {
    extensionStatus: status,
    whatsappConnected,
    openChat,
    sendText,
    sendImage,
    fallbackOpenWhatsApp,
    retryConnection,
    isConnected: status === "connected",
  };
}
