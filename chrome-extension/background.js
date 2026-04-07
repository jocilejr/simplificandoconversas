// ── Simplificando Conversas — Background Service Worker ──
// Handles API calls + routes commands between dashboard and WhatsApp tabs

// ── Tab tracking ──
let whatsappTabId = null;
let dashboardTabId = null;

// ── Existing message handler for API calls ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ── Tab registration from content scripts ──
  if (message.action === "WHATSAPP_READY") {
    whatsappTabId = sender.tab?.id || null;
    console.log("[BG] WhatsApp tab registered:", whatsappTabId);
    // Notify dashboard if connected
    if (dashboardTabId) {
      try {
        chrome.tabs.sendMessage(dashboardTabId, {
          type: "WHATSAPP_STATUS_UPDATE",
          connected: true,
        });
      } catch (e) {}
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.action === "DASHBOARD_READY") {
    dashboardTabId = sender.tab?.id || null;
    console.log("[BG] Dashboard tab registered:", dashboardTabId);
    sendResponse({ ok: true });
    return;
  }

  // ── PING: Check if WhatsApp tab is alive ──
  if (message.action === "PING") {
    if (!whatsappTabId) {
      sendResponse({ whatsappConnected: false });
      return;
    }
    chrome.tabs.sendMessage(
      whatsappTabId,
      { action: "HEARTBEAT" },
      (resp) => {
        if (chrome.runtime.lastError || !resp?.alive) {
          whatsappTabId = null;
          sendResponse({ whatsappConnected: false });
        } else {
          sendResponse({ whatsappConnected: true });
        }
      }
    );
    return true; // async
  }

  // ── Route DOM commands to WhatsApp tab ──
  if (
    message.action === "OPEN_CHAT" ||
    message.action === "SEND_TEXT" ||
    message.action === "SEND_IMAGE"
  ) {
    routeToWhatsApp(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  // ── Existing API-based actions ──
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});

// ── Clean up tab references ──
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === whatsappTabId) {
    whatsappTabId = null;
    console.log("[BG] WhatsApp tab closed");
    if (dashboardTabId) {
      try {
        chrome.tabs.sendMessage(dashboardTabId, {
          type: "WHATSAPP_STATUS_UPDATE",
          connected: false,
        });
      } catch (e) {}
    }
  }
  if (tabId === dashboardTabId) {
    dashboardTabId = null;
    console.log("[BG] Dashboard tab closed");
  }
});

// ── Find or open WhatsApp Web tab ──
async function findOrOpenWhatsApp() {
  // Check if tracked tab is still valid
  if (whatsappTabId) {
    try {
      const tab = await chrome.tabs.get(whatsappTabId);
      if (tab && tab.url?.includes("web.whatsapp.com")) {
        await chrome.tabs.update(whatsappTabId, { active: true });
        return whatsappTabId;
      }
    } catch (e) {}
    whatsappTabId = null;
  }

  // Search existing tabs
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs.length > 0) {
    whatsappTabId = tabs[0].id;
    await chrome.tabs.update(whatsappTabId, { active: true });
    return whatsappTabId;
  }

  // Open new tab
  const newTab = await chrome.tabs.create({ url: "https://web.whatsapp.com", active: true });
  whatsappTabId = newTab.id;

  // Wait for content script to load
  await new Promise((r) => setTimeout(r, 3000));
  return whatsappTabId;
}

// ── Route command to WhatsApp tab ──
async function routeToWhatsApp(message) {
  const tabId = await findOrOpenWhatsApp();
  if (!tabId) {
    return { success: false, error: "Não foi possível abrir o WhatsApp Web" };
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: "WhatsApp Web não respondeu. Tente recarregar a página.",
        });
      } else {
        resolve(response || { success: true });
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// ── EXISTING API LOGIC (preserved) ──
// ═══════════════════════════════════════════════════════════════

// ── JWT decode (no verification, just read payload) ──
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

// ── Ensure fresh token before API calls ──
async function ensureFreshToken() {
  const result = await chrome.storage.local.get(["apiUrl", "authToken", "refreshToken"]);
  if (!result.apiUrl || !result.authToken) {
    throw new Error("Extensao nao configurada. Clique no icone para configurar.");
  }

  const apiUrl = result.apiUrl.replace(/\/+$/, "");
  const payload = decodeJwtPayload(result.authToken);

  // If token expires within 60 seconds, refresh it
  if (payload && payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp - now < 60) {
      if (!result.refreshToken) {
        await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance"]);
        throw new Error("Sessao expirada. Faca login novamente no popup.");
      }
      const refreshed = await doRefreshToken(apiUrl, result.refreshToken);
      return { apiUrl, token: refreshed.access_token };
    }
  }

  return { apiUrl, token: result.authToken };
}

// ── Refresh token via GoTrue ──
async function doRefreshToken(apiUrl, refreshToken) {
  const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: "anon" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance"]);
    throw new Error("Sessao expirada. Faca login novamente no popup.");
  }

  const data = await res.json();
  if (!data.access_token) {
    await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance"]);
    throw new Error("Sessao expirada. Faca login novamente no popup.");
  }

  await chrome.storage.local.set({
    authToken: data.access_token,
    refreshToken: data.refresh_token,
  });

  return data;
}

// ── API fetch with automatic 401 retry ──
async function apiFetch(path, options = {}) {
  const { apiUrl, token } = await ensureFreshToken();
  const url = `${apiUrl}${path}`;

  let res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  // On 401, try refresh once and retry
  if (res.status === 401) {
    const stored = await chrome.storage.local.get(["refreshToken"]);
    if (stored.refreshToken) {
      try {
        const refreshed = await doRefreshToken(apiUrl, stored.refreshToken);
        res = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshed.access_token}`,
            ...(options.headers || {}),
          },
        });
      } catch {
        // refresh failed, will fall through to error below
      }
    }

    if (res.status === 401) {
      await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance"]);
      throw new Error("Sessao expirada. Faca login novamente no popup.");
    }
  }

  if (!res.ok) {
    const text = await res.text();
    // Detect HTML error pages (502/504 from Nginx) and return friendly message
    if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("502 Bad Gateway") || text.includes("504 Gateway")) {
      throw new Error(`Servidor temporariamente indisponivel (${res.status}). Tente novamente em instantes.`);
    }
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function handleMessage(msg) {
  switch (msg.action) {
    case "contact-status": {
      let url = `/api/ext/contact-status?`;
      if (msg.phone) url += `phone=${encodeURIComponent(msg.phone)}`;
      else if (msg.name) url += `name=${encodeURIComponent(msg.name)}`;
      if (msg.instance) url += `&instance=${encodeURIComponent(msg.instance)}`;
      return apiFetch(url);
    }

    case "flows":
      return apiFetch("/api/ext/flows");

    case "trigger-flow": {
      const triggerBody = { flowId: msg.flowId, instanceName: msg.instanceName };
      if (msg.phone) triggerBody.phone = msg.phone;
      if (msg.remoteJid) triggerBody.remoteJid = msg.remoteJid;
      if (msg.name) triggerBody.name = msg.name;
      return apiFetch("/api/ext/trigger-flow", {
        method: "POST",
        body: JSON.stringify(triggerBody),
      });
    }

    case "pause-flow":
      return apiFetch("/api/ext/pause-flow", {
        method: "POST",
        body: JSON.stringify({ executionId: msg.executionId }),
      });

    case "dashboard-stats":
      return apiFetch("/api/ext/dashboard");

    case "contact-cross": {
      let url = `/api/ext/contact-cross?`;
      if (msg.phone) url += `phone=${encodeURIComponent(msg.phone)}`;
      else if (msg.name) url += `name=${encodeURIComponent(msg.name)}`;
      if (msg.excludeInstance) {
        url += `&excludeInstance=${encodeURIComponent(msg.excludeInstance)}`;
      }
      return apiFetch(url);
    }

    case "remove-tag":
      return apiFetch("/api/ext/remove-tag", {
        method: "DELETE",
        body: JSON.stringify({ remoteJid: msg.remoteJid, tagName: msg.tagName }),
      });

    case "list-instances":
      return apiFetch("/api/ext/list-instances");

    case "validate-session":
      return apiFetch("/api/ext/list-instances");

    case "ai-status": {
      let url = `/api/ext/ai-status?`;
      if (msg.phone) url += `phone=${encodeURIComponent(msg.phone)}`;
      else if (msg.name) url += `name=${encodeURIComponent(msg.name)}`;
      return apiFetch(url);
    }

    case "ai-reply-toggle":
      return apiFetch("/api/ext/ai-reply-toggle", {
        method: "POST",
        body: JSON.stringify({
          remoteJid: msg.remoteJid,
          instanceName: msg.instanceName,
          enabled: msg.enabled,
        }),
      });

    case "ai-listen-toggle":
      return apiFetch("/api/ext/ai-listen-toggle", {
        method: "POST",
        body: JSON.stringify({
          remoteJid: msg.remoteJid,
          instanceName: msg.instanceName,
          enabled: msg.enabled,
        }),
      });

    default:
      throw new Error("Unknown action: " + msg.action);
  }
}
