// ── Simplificando Conversas — Content Script ──
(function () {
  if (document.getElementById("sc-ext-fab")) return;

  let panelOpen = false;
  let currentPhone = null;
  let pollTimer = null;

  // ── FAB button ──
  const fab = document.createElement("button");
  fab.id = "sc-ext-fab";
  fab.textContent = "⚡";
  fab.title = "Simplificando Conversas";
  document.body.appendChild(fab);

  // ── Panel ──
  const panel = document.createElement("div");
  panel.id = "sc-ext-panel";
  panel.innerHTML = `
    <div class="sc-header">
      <span>⚡ SC Flows</span>
      <span class="sc-phone" id="sc-phone-display">—</span>
    </div>
    <div class="sc-body" id="sc-body">
      <div class="sc-loader">Detectando contato...</div>
    </div>
  `;
  document.body.appendChild(panel);

  fab.addEventListener("click", () => {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    fab.classList.toggle("active", panelOpen);
    if (panelOpen) {
      detectContact();
      startPolling();
    } else {
      stopPolling();
    }
  });

  // ── Detect active contact from WhatsApp Web DOM ──
  function detectContact() {
    // Try multiple selectors for resilience
    const headerEl =
      document.querySelector("header span[data-testid='conversation-info-header-chat-title']") ||
      document.querySelector("#main header span[dir='auto']") ||
      document.querySelector("header ._amig span[dir='auto']");

    if (!headerEl) {
      currentPhone = null;
      document.getElementById("sc-phone-display").textContent = "—";
      document.getElementById("sc-body").innerHTML =
        '<div class="sc-loader">Abra uma conversa no WhatsApp</div>';
      return;
    }

    const raw = headerEl.textContent.trim();
    // Extract phone: remove non-digits, check if it looks like a phone
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) {
      currentPhone = digits;
    } else {
      // It's a name — we'll try to get the phone from the contact info
      // For now use the name as identifier and let the backend search
      currentPhone = raw;
    }
    document.getElementById("sc-phone-display").textContent = currentPhone;
    loadContactData();
  }

  // ── Communicate with background script ──
  function apiCall(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ── Load contact data ──
  async function loadContactData() {
    if (!currentPhone) return;
    const body = document.getElementById("sc-body");
    body.innerHTML = '<div class="sc-loader">Carregando...</div>';

    try {
      const [status, flows] = await Promise.all([
        apiCall("contact-status", { phone: currentPhone }),
        apiCall("flows"),
      ]);

      renderPanel(status, flows);
    } catch (err) {
      body.innerHTML = `<div class="sc-loader">Erro: ${err.message}<br><small>Configure a extensão no popup</small></div>`;
    }
  }

  // ── Render panel content ──
  function renderPanel(status, flows) {
    const body = document.getElementById("sc-body");
    const executions = status?.executions || [];
    const tags = status?.tags || [];
    const instances = status?.instances || [];
    const flowList = flows?.flows || [];

    let html = "";

    // Active executions
    html += '<div class="sc-section"><div class="sc-section-title">Fluxo Ativo</div>';
    if (executions.length === 0) {
      html += '<span class="sc-status-badge none">Nenhum fluxo ativo</span>';
    } else {
      executions.forEach((ex) => {
        const statusClass = ex.status === "running" ? "running" : "waiting";
        html += `
          <div class="sc-flow-item">
            <div>
              <div class="sc-flow-name">${ex.flow_name || "Fluxo"}</div>
              <span class="sc-status-badge ${statusClass}">${ex.status}</span>
            </div>
            <button class="sc-btn sc-btn-danger" data-action="pause" data-id="${ex.id}">Parar</button>
          </div>`;
      });
    }
    html += "</div>";

    // Tags
    if (tags.length > 0) {
      html += '<div class="sc-section"><div class="sc-section-title">Tags</div><div class="sc-tags">';
      tags.forEach((t) => {
        html += `<span class="sc-tag">${t.tag_name}</span>`;
      });
      html += "</div></div>";
    }

    // Trigger flow
    html += '<div class="sc-section"><div class="sc-section-title">Disparar Fluxo</div>';
    if (flowList.length === 0) {
      html += '<div class="sc-empty">Nenhum fluxo disponível</div>';
    } else {
      // Instance selector
      if (instances.length > 0) {
        html += '<select class="sc-instance-select" id="sc-instance-select">';
        instances.forEach((inst) => {
          html += `<option value="${inst.instance_name}">${inst.instance_name}</option>`;
        });
        html += "</select>";
      }
      flowList.forEach((f) => {
        html += `
          <div class="sc-flow-item">
            <span class="sc-flow-name">${f.name}</span>
            <button class="sc-btn sc-btn-primary" data-action="trigger" data-id="${f.id}">Enviar</button>
          </div>`;
      });
    }
    html += "</div>";

    body.innerHTML = html;

    // Event listeners
    body.querySelectorAll("[data-action='pause']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "...";
        try {
          await apiCall("pause-flow", { executionId: btn.dataset.id });
          loadContactData();
        } catch (e) {
          alert("Erro: " + e.message);
          btn.disabled = false;
          btn.textContent = "Parar";
        }
      });
    });

    body.querySelectorAll("[data-action='trigger']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const instanceSelect = document.getElementById("sc-instance-select");
        const instanceName = instanceSelect ? instanceSelect.value : "";
        if (!instanceName) {
          alert("Selecione uma instância");
          return;
        }
        btn.disabled = true;
        btn.textContent = "...";
        try {
          await apiCall("trigger-flow", {
            flowId: btn.dataset.id,
            phone: currentPhone,
            instanceName,
          });
          loadContactData();
        } catch (e) {
          alert("Erro: " + e.message);
          btn.disabled = false;
          btn.textContent = "Enviar";
        }
      });
    });
  }

  // ── Polling ──
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      detectContact();
    }, 5000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── MutationObserver to detect contact changes ──
  const observer = new MutationObserver(() => {
    if (panelOpen) detectContact();
  });

  // Observe the main content area for changes
  function startObserver() {
    const target = document.getElementById("app") || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  // Wait for WhatsApp Web to load then start observer
  const waitForApp = setInterval(() => {
    if (document.getElementById("app") || document.querySelector("#main")) {
      clearInterval(waitForApp);
      startObserver();
    }
  }, 1000);
})();
