import { useState, useEffect, useCallback, useRef } from "react";

type ExtensionStatus = "connected" | "disconnected" | "checking";

export function useWhatsAppExtension() {
  const [status, setStatus] = useState<ExtensionStatus>("checking");
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPong = useRef<number>(0);

  const sendCommand = useCallback((type: string, payload: Record<string, any> = {}) => {
    window.postMessage({ source: "simplificando-app", type, ...payload }, "*");
  }, []);

  // Listen for pong responses from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source === "simplificando-ext" && event.data?.type === "PONG") {
        lastPong.current = Date.now();
        setStatus("connected");
      }
    };
    window.addEventListener("message", handler);

    // Start ping loop
    const doPing = () => sendCommand("PING");
    doPing();
    pingInterval.current = setInterval(doPing, 5000);

    // Check if pong arrived after first ping
    const initialCheck = setTimeout(() => {
      if (Date.now() - lastPong.current > 4000) {
        setStatus("disconnected");
      }
    }, 3000);

    return () => {
      window.removeEventListener("message", handler);
      if (pingInterval.current) clearInterval(pingInterval.current);
      clearTimeout(initialCheck);
    };
  }, [sendCommand]);

  const openChat = useCallback((phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    sendCommand("OPEN_CHAT", { phone: cleanPhone });
  }, [sendCommand]);

  const sendText = useCallback((phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    sendCommand("SEND_TEXT", { phone: cleanPhone, text });
  }, [sendCommand]);

  const retryConnection = useCallback(() => {
    setStatus("checking");
    sendCommand("PING");
    setTimeout(() => {
      if (Date.now() - lastPong.current > 4000) {
        setStatus("disconnected");
      }
    }, 3000);
  }, [sendCommand]);

  return {
    extensionStatus: status,
    openChat,
    sendText,
    retryConnection,
    isConnected: status === "connected",
  };
}
