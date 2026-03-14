// ── Simplificando Conversas — Sidebar Content Script ──
(function () {
  if (document.getElementById("sc-sidebar")) return;

  let currentTab = "dashboard";
  let currentPhone = null;
  let currentContactName = null;
  let detectedInstance = null;
  let sidebarOpen = true;
  let pollTimer = null;
  let dashboardData = null;
  let contactData = null;
  let flowsData = null;
  let crossData = null;

  // ── SVG Icons ──
  const ICONS = {
    bolt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>',
    chevronLeft: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    chevronRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6 6"/></svg>',
    stop: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>',
    send: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };

  // ── Create Sidebar ──
  const sidebar = document.createElement("div");
  sidebar.id = "sc-sidebar";
  sidebar.innerHTML = `
    <div class="sc-sidebar-header">
      <div class="sc-sidebar-logo">
        <div class="sc-logo-icon">${ICONS.bolt}</div>
        <span>SC Flows</span>
      </div>
      <span class="sc-instance-badge" id="sc-instance-badge">Detectando...</span>
    </div>
    <div class="sc-tab-bar">
      <button class="sc-tab active" data-tab="dashboard">Dashboard</button>
      <button class="sc-tab" data-tab="contact">Contato</button>
    </div>
    <div class="sc-body" id="sc-body">
      <div class="sc-loader"><div class="sc-dot-pulse"><span></span><span></span><span></span></div></div>
    </div>
  `;
  document.body.appendChild(sidebar);

  // ── Toggle Button ──
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "sc-toggle-btn";
  toggleBtn.innerHTML = ICONS.chevronRight;
  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle("collapsed", !sidebarOpen);
    toggleBtn.classList.toggle("collapsed", !sidebarOpen);
    toggleBtn.innerHTML = sidebarOpen ? ICONS.chevronRight : ICONS.chevronLeft;
    const app = document.getElementById("app");
    if (app) app.setAttribute("data-sc-sidebar", sidebarOpen ? "open" : "closed");
    if (sidebarOpen) {
      startPolling();
      refresh();
    } else {
      stopPolling();
    }
  });

  // Shrink WhatsApp on load
  const app = document.getElementById("app");
  if (app) app.setAttribute("data-sc-sidebar", "open");

  // ── Tab switching ──
  sidebar.querySelectorAll(".sc-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      sidebar.querySelectorAll(".sc-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderCurrentTab();
    });
  });

  // ── API Communication ──
  function apiCall(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (response && response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  // ── Detect Instance ──
  async function detectInstance() {
    // Try to get the logged-in user's phone from WhatsApp Web DOM
    // The phone is visible in the profile/settings area
    // For now, we ask the backend to detect based on stored instances
    try {
      const result = await apiCall("detect-instance");
      if (result && result.instance) {
        detectedInstance = result.instance;
        const badge = document.getElementById("sc-instance-badge");
        if (badge) {
          badge.innerHTML = `<span class="sc-connection-dot connected"></span> ${detectedInstance.instance_name}`;
        }
      }
    } catch (e) {
      console.log("SC: Instance detection failed", e.message);
    }
  }

  // ── Detect Contact ──
  function detectContact() {
    const headerEl =
      document.querySelector("header span[data-testid='conversation-info-header-chat-title']") ||
      document.querySelector("#main header span[dir='auto']") ||
      document.querySelector("header ._amig span[dir='auto']");

    if (!headerEl) {
      if (currentPhone !== null) {
        currentPhone = null;
        currentContactName = null;
        contactData = null;
        crossData = null;
        if (currentTab === "contact") renderCurrentTab();
      }
      return;
    }

    const raw = headerEl.textContent.trim();
    const digits = raw.replace(/\D/g, "");
    let newPhone = null;
    let newName = null;

    if (digits.length >= 10) {
      newPhone = digits;
      newName = null;
    } else {
      newPhone = raw;
      newName = raw;
    }

    if (newPhone !== currentPhone) {
      currentPhone = newPhone;
      currentContactName = newName;
      contactData = null;
      crossData = null;
      loadContactData();
    }
  }

  // ── Load Data ──
  async function loadDashboard() {
    try {
      dashboardData = await apiCall("dashboard-stats");
      if (currentTab === "dashboard") renderCurrentTab();
    } catch (e) {
      dashboardData = { error: e.message };
      if (currentTab === "dashboard") renderCurrentTab();
    }
  }

  async function loadContactData() {
    if (!currentPhone) return;
    try {
      const [status, flows, cross] = await Promise.all([
        apiCall("contact-status", { phone: currentPhone }),
        apiCall("flows"),
        apiCall("contact-cross", { phone: currentPhone }),
      ]);
      contactData = status;
      flowsData = flows;
      crossData = cross;
      if (currentTab === "contact") renderCurrentTab();
    } catch (e) {
      contactData = { error: e.message };
      if (currentTab === "contact") renderCurrentTab();
    }
  }

  function refresh() {
    detectContact();
    loadDashboard();
    if (currentPhone) loadContactData();
  }

  // ── Render ──
  function renderCurrentTab() {
    const body = document.getElementById("sc-body");
    if (currentTab === "dashboard") {
      renderDashboard(body);
    } else {
      renderContact(body);
    }
  }

  function renderDashboard(body) {
    if (!dashboardData) {
      body.innerHTML = '<div class="sc-loader"><div class="sc-dot-pulse"><span></span><span></span><span></span></div></div>';
      return;
    }
    if (dashboardData.error) {
      body.innerHTML = `<div class="sc-empty">Erro: ${dashboardData.error}<br><small>Configure a extensao no popup</small></div>`;
      return;
    }

    const d = dashboardData;
    let html = '';

    // Stats
    html += '<div class="sc-section"><div class="sc-section-title">Resumo</div>';
    html += '<div class="sc-stats-grid">';
    html += `<div class="sc-stat-card accent-green"><div class="sc-stat-value">${d.activeFlows || 0}</div><div class="sc-stat-label">Fluxos Ativos</div></div>`;
    html += `<div class="sc-stat-card accent-blue"><div class="sc-stat-value">${d.totalContacts || 0}</div><div class="sc-stat-label">Contatos</div></div>`;
    html += `<div class="sc-stat-card accent-yellow"><div class="sc-stat-value">${d.runningExecutions || 0}</div><div class="sc-stat-label">Em Execucao</div></div>`;
    html += `<div class="sc-stat-card accent-purple"><div class="sc-stat-value">${d.totalInstances || 0}</div><div class="sc-stat-label">Instancias</div></div>`;
    html += '</div></div>';

    // Recent executions
    if (d.recentExecutions && d.recentExecutions.length > 0) {
      html += '<div class="sc-section"><div class="sc-section-title">Execucoes Recentes</div>';
      d.recentExecutions.slice(0, 8).forEach((ex) => {
        const statusClass = ex.status === "running" ? "running" : ex.status === "waiting" ? "waiting" : ex.status === "completed" ? "completed" : "none";
        const timeAgo = formatTimeAgo(ex.created_at);
        html += `
          <div class="sc-recent-item">
            <div class="sc-recent-item-info">
              <div class="sc-recent-item-name">${ex.flow_name || "Fluxo"}</div>
              <div class="sc-recent-item-meta">${ex.contact_name || ex.remote_jid?.split("@")[0] || "—"} · ${timeAgo}</div>
            </div>
            <span class="sc-status-badge ${statusClass}">${ex.status}</span>
          </div>`;
      });
      html += '</div>';
    }

    body.innerHTML = html;
  }

  function renderContact(body) {
    if (!currentPhone) {
      body.innerHTML = `
        <div class="sc-no-contact">
          <div class="sc-no-contact-icon">${ICONS.user}</div>
          <div class="sc-no-contact-title">Nenhum contato selecionado</div>
          <div class="sc-no-contact-desc">Abra uma conversa no WhatsApp para ver os detalhes do contato</div>
        </div>`;
      return;
    }

    if (!contactData) {
      body.innerHTML = '<div class="sc-loader"><div class="sc-dot-pulse"><span></span><span></span><span></span></div></div>';
      return;
    }

    if (contactData.error) {
      body.innerHTML = `<div class="sc-empty">Erro: ${contactData.error}</div>`;
      return;
    }

    const contact = contactData.contact;
    const executions = contactData.executions || [];
    const tags = contactData.tags || [];
    const flows = flowsData?.flows || [];
    const crossInstances = crossData?.conversations || [];

    const displayName = contact?.contact_name || currentContactName || currentPhone;
    const displayPhone = contact?.phone_number || (currentPhone.match(/^\d+$/) ? currentPhone : "");
    const initials = displayName.substring(0, 2).toUpperCase();

    let html = '';

    // Contact header
    html += `
      <div class="sc-contact-header">
        <div class="sc-contact-avatar">${initials}</div>
        <div class="sc-contact-info">
          <div class="sc-contact-name">${displayName}</div>
          <div class="sc-contact-phone">${displayPhone ? "+" + displayPhone : ""}</div>
        </div>
        <button class="sc-btn sc-btn-secondary" id="sc-refresh-contact" title="Atualizar">${ICONS.refresh}</button>
      </div>`;

    // Tags
    if (tags.length > 0) {
      html += '<div class="sc-section"><div class="sc-section-title">Tags</div><div class="sc-tags">';
      tags.forEach((t) => { html += `<span class="sc-tag">${t.tag_name}</span>`; });
      html += '</div></div>';
    }

    // Active executions
    html += '<div class="sc-section"><div class="sc-section-title">Fluxo Ativo</div>';
    const activeExecs = executions.filter((e) => e.status === "running" || e.status === "waiting");
    if (activeExecs.length === 0) {
      html += '<span class="sc-status-badge none">Nenhum fluxo ativo</span>';
    } else {
      activeExecs.forEach((ex) => {
        const statusClass = ex.status === "running" ? "running" : "waiting";
        html += `
          <div class="sc-flow-item">
            <div>
              <div class="sc-flow-name">${ex.flow_name || "Fluxo"}</div>
              <span class="sc-status-badge ${statusClass}">${ICONS.play} ${ex.status}</span>
            </div>
            <button class="sc-btn sc-btn-danger" data-action="pause" data-id="${ex.id}">${ICONS.stop} Parar</button>
          </div>`;
      });
    }
    html += '</div>';

    // Cross-instance conversations
    if (crossInstances.length > 0) {
      html += '<div class="sc-section"><div class="sc-section-title">Conversas em Outros Numeros</div>';
      crossInstances.forEach((conv) => {
        html += `
          <div class="sc-cross-card">
            <div class="sc-cross-card-header">
              <span class="sc-cross-instance-name">${ICONS.link} ${conv.instance_name || "—"}</span>
              <span class="sc-cross-date">${conv.last_message_at ? formatTimeAgo(conv.last_message_at) : ""}</span>
            </div>
            <div class="sc-cross-last-msg">${conv.last_message || "Sem mensagens"}</div>
          </div>`;
      });
      html += '</div>';
    }

    // Trigger flow
    html += '<div class="sc-section"><div class="sc-section-title">Disparar Fluxo</div>';
    if (flows.length === 0) {
      html += '<div class="sc-empty">Nenhum fluxo disponivel</div>';
    } else {
      flows.forEach((f) => {
        html += `
          <div class="sc-flow-item">
            <span class="sc-flow-name">${f.name}</span>
            <button class="sc-btn sc-btn-primary" data-action="trigger" data-id="${f.id}">${ICONS.send} Enviar</button>
          </div>`;
      });
    }
    html += '</div>';

    // Execution history
    const historyExecs = contactData.history || [];
    if (historyExecs.length > 0) {
      html += '<div class="sc-section"><div class="sc-section-title">Historico</div>';
      historyExecs.slice(0, 10).forEach((ex) => {
        const dotClass = ex.status === "completed" ? "completed" : ex.status === "cancelled" ? "cancelled" : "running";
        html += `
          <div class="sc-history-item">
            <div class="sc-history-dot ${dotClass}"></div>
            <div class="sc-history-info">
              <div class="sc-history-name">${ex.flow_name || "Fluxo"}</div>
              <div class="sc-history-date">${formatTimeAgo(ex.created_at)} · ${ex.status}</div>
            </div>
          </div>`;
      });
      html += '</div>';
    }

    body.innerHTML = html;

    // Event listeners
    const refreshBtn = document.getElementById("sc-refresh-contact");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        contactData = null;
        renderCurrentTab();
        loadContactData();
      });
    }

    body.querySelectorAll("[data-action='pause']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await apiCall("pause-flow", { executionId: btn.dataset.id });
          loadContactData();
        } catch (e) {
          alert("Erro: " + e.message);
          btn.disabled = false;
        }
      });
    });

    body.querySelectorAll("[data-action='trigger']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!detectedInstance) {
          alert("Instancia nao detectada. Verifique a conexao.");
          return;
        }
        btn.disabled = true;
        btn.innerHTML = '<div class="sc-dot-pulse"><span></span><span></span><span></span></div>';
        try {
          await apiCall("trigger-flow", {
            flowId: btn.dataset.id,
            phone: currentPhone,
            instanceName: detectedInstance.instance_name,
          });
          loadContactData();
        } catch (e) {
          alert("Erro: " + e.message);
          btn.disabled = false;
          btn.innerHTML = `${ICONS.send} Enviar`;
        }
      });
    });
  }

  // ── Utilities ──
  function formatTimeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  // ── Polling ──
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      detectContact();
      if (currentTab === "dashboard") loadDashboard();
      if (currentTab === "contact" && currentPhone) loadContactData();
    }, 8000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── MutationObserver ──
  const observer = new MutationObserver(() => {
    if (sidebarOpen) detectContact();
  });

  function startObserver() {
    const target = document.getElementById("app") || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  // ── Init ──
  const waitForApp = setInterval(() => {
    if (document.getElementById("app") || document.querySelector("#main")) {
      clearInterval(waitForApp);
      startObserver();
      detectInstance();
      loadDashboard();
      detectContact();
      startPolling();
    }
  }, 1000);
})();
