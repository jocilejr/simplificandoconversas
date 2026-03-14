// ── Simplificando Conversas — Background Service Worker ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // async response
});

async function getConfig() {
  const result = await chrome.storage.local.get(["apiUrl", "authToken"]);
  if (!result.apiUrl || !result.authToken) {
    throw new Error("Extensão não configurada. Clique no ícone para configurar.");
  }
  return { apiUrl: result.apiUrl.replace(/\/+$/, ""), token: result.authToken };
}

async function apiFetch(path, options = {}) {
  const { apiUrl, token } = await getConfig();
  const url = `${apiUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function handleMessage(msg) {
  switch (msg.action) {
    case "contact-status":
      return apiFetch(`/functions/v1/ext/contact-status?phone=${encodeURIComponent(msg.phone)}`);

    case "flows":
      return apiFetch("/functions/v1/ext/flows");

    case "trigger-flow":
      return apiFetch("/functions/v1/ext/trigger-flow", {
        method: "POST",
        body: JSON.stringify({
          flowId: msg.flowId,
          phone: msg.phone,
          instanceName: msg.instanceName,
        }),
      });

    case "pause-flow":
      return apiFetch("/functions/v1/ext/pause-flow", {
        method: "POST",
        body: JSON.stringify({ executionId: msg.executionId }),
      });

    default:
      throw new Error("Unknown action: " + msg.action);
  }
}
