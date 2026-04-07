// ── Simplificando Conversas — Dashboard Content Script ──
// Bridges window.postMessage ↔ chrome.runtime (background.js)
// Runs on the dashboard page (VPS domain + lovable domains)

(function () {
  const TAG = "[SC-Dashboard]";
  const processedRequests = new Set();

  console.log(TAG, "Content script loaded on dashboard page");

  // ── Announce presence ──
  window.postMessage({ type: "WHATSAPP_EXTENSION_LOADED" }, "*");

  // ── Listen for messages from the web app (React hook) ──
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    const type = data.type;

    // ── PING: Respond immediately + check WhatsApp connection via background ──
    if (type === "WHATSAPP_EXTENSION_PING" || type === "PING") {
      window.postMessage({ type: "WHATSAPP_EXTENSION_READY" }, "*");

      chrome.runtime.sendMessage({ action: "PING" }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            type: "WHATSAPP_CONNECTION_STATUS",
            connected: false,
          }, "*");
          return;
        }
        window.postMessage({
          type: "WHATSAPP_CONNECTION_STATUS",
          connected: response?.whatsappConnected || false,
        }, "*");
      });
      return;
    }

    // ── CHECK CONNECTION ──
    if (type === "WHATSAPP_CHECK_CONNECTION") {
      chrome.runtime.sendMessage({ action: "PING" }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            type: "WHATSAPP_CONNECTION_STATUS",
            connected: false,
            requestId: data.requestId,
          }, "*");
          return;
        }
        window.postMessage({
          type: "WHATSAPP_CONNECTION_STATUS",
          connected: response?.whatsappConnected || false,
          requestId: data.requestId,
        }, "*");
      });
      return;
    }

    // ── Commands: OPEN_CHAT, SEND_TEXT, SEND_IMAGE ──
    const commandMap = {
      WHATSAPP_OPEN_CHAT: "OPEN_CHAT",
      WHATSAPP_SEND_TEXT: "SEND_TEXT",
      WHATSAPP_SEND_IMAGE: "SEND_IMAGE",
      OPEN_CHAT: "OPEN_CHAT",
      SEND_TEXT: "SEND_TEXT",
      SEND_IMAGE: "SEND_IMAGE",
    };

    // Also handle envelope format
    if (type === "WHATSAPP_EXTENSION_COMMAND" && data.command) {
      data.type = data.command;
    }

    const action = commandMap[data.type || type];
    if (!action) return;

    // Dedup by requestId
    const requestId = data.requestId || `${action}-${Date.now()}`;
    if (processedRequests.has(requestId)) return;
    processedRequests.add(requestId);
    setTimeout(() => processedRequests.delete(requestId), 10000);

    console.log(TAG, "Forwarding command to background:", action, data);

    chrome.runtime.sendMessage(
      {
        action: action,
        phone: data.phone,
        text: data.text,
        imageDataUrl: data.imageDataUrl,
        requestId: requestId,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn(TAG, "Background error:", chrome.runtime.lastError.message);
          window.postMessage({
            type: "WHATSAPP_RESPONSE",
            requestId: requestId,
            success: false,
            error: chrome.runtime.lastError.message,
          }, "*");
          return;
        }
        window.postMessage({
          type: "WHATSAPP_RESPONSE",
          requestId: requestId,
          success: response?.success ?? true,
          error: response?.error,
          data: response?.data,
        }, "*");
      }
    );
  });

  // ── Listen for messages from background (e.g., connection status updates) ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "WHATSAPP_STATUS_UPDATE") {
      window.postMessage({
        type: "WHATSAPP_CONNECTION_STATUS",
        connected: message.connected,
      }, "*");
    }
    sendResponse({ ok: true });
  });
})();
