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
  let aiStatusData = null;

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
    activity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    inbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    server: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
    history: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',
    ear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/></svg>',
  };

  // ── Create Sidebar (called after WhatsApp app is ready) ──
  let sidebar, toggleBtn;

  function createSidebar() {
    // Don't duplicate
    if (document.getElementById("sc-sidebar")) return;

    sidebar = document.createElement("div");
    sidebar.id = "sc-sidebar";
    sidebar.innerHTML = `
      <div class="sc-sidebar-header">
        <div class="sc-sidebar-logo">
          <img src="${chrome.runtime.getURL('icons/logo-ov.png')}" class="sc-logo-img" alt="Logo">
          <span>Origem Viva</span>
        </div>
        <span class="sc-instance-badge" id="sc-instance-badge">Carregando...</span>
      </div>
      <div class="sc-tab-bar">
        <button class="sc-tab active" data-tab="dashboard">${ICONS.activity} Dashboard</button>
        <button class="sc-tab" data-tab="contact">${ICONS.user} Contato</button>
      </div>
      <div class="sc-body" id="sc-body">
        <div class="sc-loader"><div class="sc-dot-pulse"><span></span><span></span><span></span></div></div>
      </div>
    `;
    document.body.appendChild(sidebar);

    // Toggle Button
    toggleBtn = document.createElement("button");
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

    // Tab switching
    sidebar.querySelectorAll(".sc-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        currentTab = tab.dataset.tab;
        sidebar.querySelectorAll(".sc-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        renderCurrentTab();
      });
    });

    // Shrink WhatsApp
    const app = document.getElementById("app");
    if (app) app.setAttribute("data-sc-sidebar", "open");
  }




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

  // ── Load Instance from Storage ──
  function loadInstanceFromStorage() {
    chrome.storage.local.get(["selectedInstance"], (result) => {
      if (result.selectedInstance && result.selectedInstance.instance_name) {
        detectedInstance = result.selectedInstance;
        const badge = document.getElementById("sc-instance-badge");
        if (badge) {
          badge.innerHTML = `<span class="sc-connection-dot connected"></span> ${detectedInstance.instance_name}`;
        }
      } else {
        detectedInstance = null;
        const badge = document.getElementById("sc-instance-badge");
        if (badge) {
          badge.innerHTML = `<span class="sc-connection-dot"></span> Não configurada`;
        }
      }
    });
  }

  // Listen for storage changes (when user selects instance in popup)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.selectedInstance) {
      loadInstanceFromStorage();
    }
  });

  // ── Extract phone from WhatsApp UI (drawer, header subtitle, side panel) ──
  function extractPhoneFromUI() {
    // Broader set of selectors to find phone numbers anywhere in the visible UI
    const selectors = [
      // Header subtitle area (shows phone when name is in title)
      'header span[data-testid="conversation-info-header-chat-subtitle"]',
      'header div._amig span[dir="auto"]:not(:first-child)',
      '#main header div > span:nth-child(2)',
      // Contact info drawer
      'div[data-testid="contact-info-drawer"] span.selectable-text span',
      'div[data-testid="contact-info-drawer"] span[data-testid="selectable-text"]',
      // Right panel / contact info section
      'section span[data-testid="selectable-text"]',
      '#app div[tabindex] section span[dir="auto"]',
      // The "phone" row inside contact info
      'div[data-testid="chat-info-drawer"] span[dir="auto"]',
      // Fallback: any visible element in the right side panel
      'div[data-testid="conversation-panel-wrapper"] + div span[dir="auto"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent || '';
        // Match phone patterns like +55 89 8134-0810 or 5589981340810
        const phoneMatch = text.match(/\+?\d[\d\s\-()]{8,}/);
        if (phoneMatch) {
          const digits = phoneMatch[0].replace(/\D/g, '');
          if (digits.length >= 10 && digits.length <= 15) {
            console.log('[SC] extractPhoneFromUI found:', digits, 'via selector:', sel);
            return digits;
          }
        }
      }
    }
    console.log('[SC] extractPhoneFromUI: no phone found in UI');
    return null;
  }

  // ── Detect Contact ──
  function detectContact() {
    const headerEl =
      document.querySelector("header span[data-testid='conversation-info-header-chat-title']") ||
      document.querySelector("#main header span[dir='auto']") ||
      document.querySelector("header ._amig span[dir='auto']");

    if (!headerEl) {
      if (currentPhone !== null || currentContactName !== null) {
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
      // Header shows a saved name — try to extract phone from the contact info drawer
      const drawerPhone = extractPhoneFromDrawer();
      if (drawerPhone) {
        newPhone = drawerPhone;
        newName = raw; // keep name for display
      } else {
        newPhone = null;
        newName = raw;
      }
    }

    const identifier = newPhone || newName;
    const prevIdentifier = currentPhone || currentContactName;
    if (identifier !== prevIdentifier) {
      currentPhone = newPhone;
      currentContactName = newName;
      contactData = null;
      crossData = null;
      aiStatusData = null;
      loadContactData();
    }
  }

  // ── Load Data (with in-flight guards & backoff) ──
  let dashboardRetries = 0;
  let dashboardInFlight = false;
  let contactInFlight = false;
  let errorBackoffCycles = 0;

  async function loadDashboard() {
    if (dashboardInFlight) return;
    dashboardInFlight = true;
    try {
      dashboardData = await apiCall("dashboard-stats");
      dashboardRetries = 0;
      errorBackoffCycles = 0;
      if (currentTab === "dashboard") renderCurrentTab();
    } catch (e) {
      dashboardData = { error: e.message };
      errorBackoffCycles = Math.min(errorBackoffCycles + 1, 3);
      if (currentTab === "dashboard") renderCurrentTab();
      if (dashboardRetries < 1) {
        dashboardRetries++;
        setTimeout(loadDashboard, 2000);
      }
    } finally {
      dashboardInFlight = false;
    }
  }

  async function loadContactData() {
    if (!currentPhone && !currentContactName) return;
    if (contactInFlight) return;
    contactInFlight = true;
    try {
      const lookupParam = currentPhone
        ? { phone: currentPhone }
        : { name: currentContactName };
      const instanceParam = detectedInstance?.instance_name ? { instance: detectedInstance.instance_name } : {};
      const [status, flows, cross, aiStatus] = await Promise.all([
        apiCall("contact-status", { ...lookupParam, ...instanceParam }),
        apiCall("flows"),
        apiCall("contact-cross", { ...lookupParam, excludeInstance: detectedInstance?.instance_name || '' }),
        apiCall("ai-status", { ...lookupParam, ...instanceParam }),
      ]);
      contactData = status;
      flowsData = flows;
      crossData = cross;
      aiStatusData = aiStatus;
      errorBackoffCycles = 0;
      if (currentTab === "contact") renderCurrentTab();
    } catch (e) {
      contactData = { error: e.message };
      errorBackoffCycles = Math.min(errorBackoffCycles + 1, 3);
      if (currentTab === "contact") renderCurrentTab();
    } finally {
      contactInFlight = false;
    }
  }

  function refresh() {
    detectContact();
    loadDashboard();
    if (currentPhone || currentContactName) loadContactData();
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
      body.innerHTML = `
        <div class="sc-error-state">
          <div class="sc-error-icon">!</div>
          <div class="sc-error-title">Falha ao carregar</div>
          <div class="sc-error-desc">${dashboardData.error}</div>
          <button class="sc-btn sc-btn-secondary" id="sc-retry-dashboard">${ICONS.refresh} Tentar novamente</button>
        </div>`;
      const retryBtn = body.querySelector("#sc-retry-dashboard");
      if (retryBtn) retryBtn.addEventListener("click", () => { dashboardData = null; renderCurrentTab(); loadDashboard(); });
      return;
    }

    const d = dashboardData;
    let html = '';

    // Stats
    html += '<div class="sc-section">';
    html += '<div class="sc-section-header"><div class="sc-section-title">Resumo Geral</div></div>';
    html += '<div class="sc-stats-grid">';
    html += `<div class="sc-stat-card accent-green">
      <div class="sc-stat-icon green">${ICONS.bolt}</div>
      <div class="sc-stat-content"><div class="sc-stat-value">${d.activeFlows || 0}</div><div class="sc-stat-label">Fluxos Ativos</div></div>
    </div>`;
    html += `<div class="sc-stat-card accent-blue">
      <div class="sc-stat-icon blue">${ICONS.users}</div>
      <div class="sc-stat-content"><div class="sc-stat-value">${d.totalContacts || 0}</div><div class="sc-stat-label">Contatos</div></div>
    </div>`;
    html += `<div class="sc-stat-card accent-yellow">
      <div class="sc-stat-icon yellow">${ICONS.activity}</div>
      <div class="sc-stat-content"><div class="sc-stat-value">${d.runningExecutions || 0}</div><div class="sc-stat-label">Em Execucao</div></div>
    </div>`;
    html += `<div class="sc-stat-card accent-purple">
      <div class="sc-stat-icon purple">${ICONS.server}</div>
      <div class="sc-stat-content"><div class="sc-stat-value">${d.totalInstances || 0}</div><div class="sc-stat-label">Instancias</div></div>
    </div>`;
    html += '</div></div>';

    // Recent executions
    if (d.recentExecutions && d.recentExecutions.length > 0) {
      html += '<div class="sc-section">';
      html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.history} Execucoes Recentes</div></div>`;
      d.recentExecutions.slice(0, 8).forEach((ex) => {
        const statusClass = ex.status === "running" ? "running" : (ex.status === "waiting" || ex.status === "waiting_click" || ex.status === "waiting_reply") ? "waiting" : ex.status === "completed" ? "completed" : "none";
        const statusLabel = ex.status === "running" ? "Rodando" : ex.status === "waiting" ? "Aguardando" : ex.status === "waiting_click" ? "Aguardando Clique" : ex.status === "waiting_reply" ? "Aguardando Resposta" : ex.status === "completed" ? "Concluido" : ex.status === "cancelled" ? "Cancelado" : ex.status;
        const timeAgo = formatTimeAgo(ex.created_at);
        html += `
          <div class="sc-recent-item">
            <div class="sc-recent-dot ${statusClass}"></div>
            <div class="sc-recent-item-info">
              <div class="sc-recent-item-name">${ex.flow_name || "Fluxo"}</div>
              <div class="sc-recent-item-meta">${ex.contact_name || ex.remote_jid?.split("@")[0] || "—"} · ${timeAgo}</div>
            </div>
            <span class="sc-status-badge ${statusClass}">${statusLabel}</span>
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="sc-section">';
      html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.history} Execucoes Recentes</div></div>`;
      html += '<div class="sc-empty-state"><div class="sc-empty-icon">${ICONS.inbox}</div><div class="sc-empty-text">Nenhuma execucao recente</div></div>';
      html += '</div>';
    }

    // Reminders section
    const reminders = d.reminders || [];
    html += '<div class="sc-section">';
    html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.clock} Lembretes</div></div>`;
    if (reminders.length > 0) {
      reminders.forEach((r) => {
        const due = new Date(r.due_date);
        const now = new Date();
        const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const brDue = new Date(due.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const todayStart = new Date(brNow.getFullYear(), brNow.getMonth(), brNow.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86400000);
        
        let statusClass = 'future';
        let statusLabel = brDue.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (r.completed) {
          statusClass = 'completed';
          statusLabel = 'Concluído';
        } else if (brDue < todayStart) {
          statusClass = 'overdue';
          statusLabel = 'Atrasado';
        } else if (brDue >= todayStart && brDue < todayEnd) {
          statusClass = 'today';
          statusLabel = brDue.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        }
        
        html += `
          <div class="sc-reminder-item ${statusClass}">
            <div class="sc-reminder-info">
              <div class="sc-reminder-title">${r.title}</div>
              <div class="sc-reminder-meta">${r.contact_name || r.phone_number || ''} ${r.description ? '· ' + r.description.substring(0, 40) : ''}</div>
            </div>
            <span class="sc-reminder-badge ${statusClass}">${statusLabel}</span>
          </div>`;
      });
    } else {
      html += '<div class="sc-empty-state"><div class="sc-empty-text">Nenhum lembrete pendente</div></div>';
    }
    html += '</div>';

    body.innerHTML = html;
  }

  function renderContact(body) {
    if (!currentPhone && !currentContactName) {
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
      body.innerHTML = `
        <div class="sc-error-state">
          <div class="sc-error-icon">!</div>
          <div class="sc-error-title">Falha ao carregar contato</div>
          <div class="sc-error-desc">${contactData.error}</div>
          <button class="sc-btn sc-btn-secondary" id="sc-retry-contact">${ICONS.refresh} Tentar novamente</button>
        </div>`;
      const retryBtn = body.querySelector("#sc-retry-contact");
      if (retryBtn) retryBtn.addEventListener("click", () => { contactData = null; renderCurrentTab(); loadContactData(); });
      return;
    }

    const contact = contactData.contact;
    const executions = contactData.executions || [];
    const tags = contactData.tags || [];
    const flows = flowsData?.flows || [];
    const crossInstances = crossData?.conversations || [];

    const displayName = contact?.contact_name || currentContactName || currentPhone || "?";
    const resolvedPhone = contact?.phone_number || (currentPhone && currentPhone.match(/^\d+$/) ? currentPhone : "");
    const resolvedRemoteJid = contact?.remote_jid || (resolvedPhone ? `${resolvedPhone}@s.whatsapp.net` : "");
    const displayPhone = resolvedPhone;
    const initials = displayName.substring(0, 2).toUpperCase();

    let html = '';

    // Contact header
    html += `
      <div class="sc-contact-header">
        <div class="sc-contact-avatar">${initials}</div>
        <div class="sc-contact-info">
          <div class="sc-contact-name">${displayName}</div>
          ${displayPhone ? `<div class="sc-contact-phone">+${displayPhone}</div>` : ''}
        </div>
        <button class="sc-btn sc-btn-secondary sc-btn-icon" id="sc-refresh-contact" title="Atualizar">${ICONS.refresh}</button>
      </div>`;

    // AI Toggles
    const hasActiveFlow = executions.some((e) => ["running", "waiting", "waiting_click", "waiting_reply"].includes(e.status));
    const aiReplyEnabled = aiStatusData?.reply || false;
    const aiListenEnabled = aiStatusData?.listen || false;
    const aiRemoteJid = aiStatusData?.remoteJid || contact?.remote_jid || '';

    html += '<div class="sc-section">';
    html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.brain} Inteligência Artificial</div></div>`;
    html += '<div class="sc-ai-toggles">';
    
    // AI Reply toggle
    html += `
      <div class="sc-ai-toggle-row">
        <div class="sc-ai-toggle-info">
          <span class="sc-ai-toggle-label">${ICONS.brain} IA Responde</span>
          <span class="sc-ai-toggle-desc">${hasActiveFlow && !aiReplyEnabled ? 'Desativado (fluxo ativo)' : aiReplyEnabled ? 'Respondendo automaticamente' : 'Desativado'}</span>
        </div>
        <label class="sc-toggle ${hasActiveFlow && !aiReplyEnabled ? 'disabled' : ''}">
          <input type="checkbox" id="sc-ai-reply-toggle" ${aiReplyEnabled ? 'checked' : ''} ${hasActiveFlow && !aiReplyEnabled ? 'disabled' : ''}>
          <span class="sc-toggle-slider"></span>
        </label>
      </div>`;
    
    // AI Listen toggle
    html += `
      <div class="sc-ai-toggle-row">
        <div class="sc-ai-toggle-info">
          <span class="sc-ai-toggle-label">${ICONS.ear} IA Escuta</span>
          <span class="sc-ai-toggle-desc">${aiListenEnabled ? 'Monitorando mensagens' : 'Desativado'}</span>
        </div>
        <label class="sc-toggle">
          <input type="checkbox" id="sc-ai-listen-toggle" ${aiListenEnabled ? 'checked' : ''}>
          <span class="sc-toggle-slider"></span>
        </label>
      </div>`;
    
    html += '</div></div>';

    // Tags
    if (tags.length > 0) {
      const remoteJid = contact?.remote_jid || '';
      html += `<div class="sc-section"><div class="sc-section-header"><div class="sc-section-title">${ICONS.tag} Tags</div></div><div class="sc-tags">`;
      tags.forEach((t) => { html += `<span class="sc-tag">${t.tag_name}<button class="sc-tag-remove" data-jid="${remoteJid}" data-tag="${t.tag_name}" title="Remover tag">&times;</button></span>`; });
      html += '</div></div>';
    }

    // Active executions
    const activeExecs = executions.filter((e) => ["running", "waiting", "waiting_click", "waiting_reply"].includes(e.status));
    html += '<div class="sc-section">';
    html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.play} Fluxo Ativo</div></div>`;
    if (activeExecs.length === 0) {
      html += '<div class="sc-inactive-flow"><span class="sc-status-badge none">Nenhum fluxo ativo</span></div>';
    } else {
      activeExecs.forEach((ex) => {
        const statusClass = ex.status === "running" ? "running" : "waiting";
        const statusLabel = ex.status === "running" ? "Rodando" : ex.status === "waiting_click" ? "Aguardando Clique" : ex.status === "waiting_reply" ? "Aguardando Resposta" : "Aguardando";
        html += `
          <div class="sc-active-flow-card ${statusClass}">
            <div class="sc-active-flow-info">
              <div class="sc-flow-name">${ex.flow_name || "Fluxo"}</div>
              <span class="sc-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <button class="sc-btn sc-btn-danger" data-action="pause" data-id="${ex.id}">${ICONS.stop} Parar</button>
          </div>`;
      });
    }
    html += '</div>';

    // Cross-instance conversations (only OTHER instances)
    if (crossInstances.length > 0) {
      html += '<div class="sc-section">';
      html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.link} Outros Numeros</div></div>`;
      crossInstances.forEach((conv) => {
        html += `
          <div class="sc-cross-card">
            <div class="sc-cross-card-header">
              <span class="sc-cross-instance-name">${conv.instance_name || "—"}</span>
              <span class="sc-cross-date">${conv.last_message_at ? formatTimeAgo(conv.last_message_at) : ""}</span>
            </div>
            <div class="sc-cross-last-msg">${conv.last_message || "Sem mensagens"}</div>
          </div>`;
      });
      html += '</div>';
    }

    // Trigger flow
    html += '<div class="sc-section">';
    html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.send} Disparar Fluxo</div></div>`;
    if (flows.length === 0) {
      html += '<div class="sc-empty-state"><div class="sc-empty-text">Nenhum fluxo disponivel</div></div>';
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
      html += '<div class="sc-section">';
      html += `<div class="sc-section-header"><div class="sc-section-title">${ICONS.history} Historico</div></div>`;
      historyExecs.slice(0, 10).forEach((ex) => {
        const dotClass = ex.status === "completed" ? "completed" : ex.status === "cancelled" ? "cancelled" : "running";
        const statusLabel = ex.status === "completed" ? "Concluido" : ex.status === "cancelled" ? "Cancelado" : ex.status;
        html += `
          <div class="sc-history-item">
            <div class="sc-history-dot ${dotClass}"></div>
            <div class="sc-history-info">
              <div class="sc-history-name">${ex.flow_name || "Fluxo"}</div>
              <div class="sc-history-date">${formatTimeAgo(ex.created_at)} · ${statusLabel}</div>
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

    // AI Reply toggle
    const aiReplyToggle = document.getElementById("sc-ai-reply-toggle");
    if (aiReplyToggle) {
      aiReplyToggle.addEventListener("change", async () => {
        const enabled = aiReplyToggle.checked;
        if (!detectedInstance) {
          aiReplyToggle.checked = !enabled;
          return;
        }
        aiReplyToggle.disabled = true;
        try {
          await apiCall("ai-reply-toggle", {
            remoteJid: aiRemoteJid,
            instanceName: detectedInstance.instance_name,
            enabled,
          });
          aiStatusData = { ...aiStatusData, reply: enabled };
          loadContactData();
        } catch (e) {
          aiReplyToggle.checked = !enabled;
          alert("Erro: " + e.message);
        } finally {
          aiReplyToggle.disabled = false;
        }
      });
    }

    // AI Listen toggle
    const aiListenToggle = document.getElementById("sc-ai-listen-toggle");
    if (aiListenToggle) {
      aiListenToggle.addEventListener("change", async () => {
        const enabled = aiListenToggle.checked;
        if (!detectedInstance) {
          aiListenToggle.checked = !enabled;
          return;
        }
        aiListenToggle.disabled = true;
        try {
          await apiCall("ai-listen-toggle", {
            remoteJid: aiRemoteJid,
            instanceName: detectedInstance.instance_name,
            enabled,
          });
          aiStatusData = { ...aiStatusData, listen: enabled };
          loadContactData();
        } catch (e) {
          aiListenToggle.checked = !enabled;
          alert("Erro: " + e.message);
        } finally {
          aiListenToggle.disabled = false;
        }
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
          showInlineError(btn, "Configure a instância no popup da extensão");
          return;
        }
        btn.disabled = true;
        btn.innerHTML = '<div class="sc-dot-pulse"><span></span><span></span><span></span></div>';
        try {
          const triggerData = { flowId: btn.dataset.id, instanceName: detectedInstance.instance_name };
          if (resolvedPhone) {
            triggerData.phone = resolvedPhone;
          } else if (resolvedRemoteJid) {
            triggerData.remoteJid = resolvedRemoteJid;
          } else if (currentContactName) {
            triggerData.name = currentContactName;
          }
          await apiCall("trigger-flow", triggerData);
          loadContactData();
        } catch (e) {
          alert("Erro: " + e.message);
          btn.disabled = false;
          btn.innerHTML = `${ICONS.send} Enviar`;
        }
      });
    });

    // Tag remove buttons
    body.querySelectorAll(".sc-tag-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const jid = btn.dataset.jid;
        const tag = btn.dataset.tag;
        if (!jid || !tag) return;
        btn.disabled = true;
        btn.style.opacity = "0.3";
        try {
          await apiCall("remove-tag", { remoteJid: jid, tagName: tag });
          loadContactData();
        } catch (err) {
          alert("Erro ao remover tag: " + err.message);
          btn.disabled = false;
          btn.style.opacity = "1";
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

  // ── Polling (with backoff on errors) ──
  function startPolling() {
    stopPolling();
    function poll() {
      const interval = errorBackoffCycles > 0 ? 8000 + errorBackoffCycles * 6000 : 8000;
      pollTimer = setTimeout(() => {
        detectContact();
        if (currentTab === "dashboard") loadDashboard();
        if (currentTab === "contact" && (currentPhone || currentContactName)) loadContactData();
        poll();
      }, interval);
    }
    poll();
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

  // ── Inline error helper ──
  function showInlineError(btn, msg) {
    const parent = btn.closest(".sc-flow-item") || btn.parentElement;
    let errEl = parent.querySelector(".sc-inline-error");
    if (!errEl) {
      errEl = document.createElement("div");
      errEl.className = "sc-inline-error";
      errEl.style.cssText = "color:#ef4444;font-size:11px;margin-top:4px;";
      parent.appendChild(errEl);
    }
    errEl.textContent = msg;
    setTimeout(() => { if (errEl) errEl.remove(); }, 4000);
  }

  // ── Init: wait for WhatsApp to fully render (not just #app shell) ──
  function isWhatsAppReady() {
    return !!(
      document.querySelector('#side') ||
      document.querySelector('div[data-testid="chat-list"]') ||
      document.querySelector('#main header') ||
      document.querySelector('div[data-testid="default-user"]')
    );
  }

  const waitForApp = setInterval(() => {
    if (isWhatsAppReady()) {
      clearInterval(waitForApp);
      console.log("SC: WhatsApp ready, injecting sidebar");
      createSidebar();
      startObserver();
      loadInstanceFromStorage();
      loadDashboard();
      detectContact();
      startPolling();
    }
  }, 1000);

  // ── Watchdog: re-inject sidebar if WhatsApp destroys it ──
  setInterval(() => {
    if (!isWhatsAppReady()) return; // WhatsApp not ready yet, skip
    if (!document.getElementById("sc-sidebar")) {
      console.log("SC: Sidebar missing, re-injecting...");
      // Clean up orphaned elements
      const oldToggle = document.getElementById("sc-toggle-btn");
      if (oldToggle) oldToggle.remove();
      createSidebar();
      startObserver();
      loadInstanceFromStorage();
      loadDashboard();
      detectContact();
      startPolling();
    }
  }, 3000);
})();
