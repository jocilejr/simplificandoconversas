// ── Simplificando Conversas — Popup Config ──

const apiUrlInput = document.getElementById("apiUrl");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const loginSection = document.getElementById("loginSection");
const loggedSection = document.getElementById("loggedSection");
const workspaceSelect = document.getElementById("workspaceSelect");
const workspaceStatus = document.getElementById("workspaceStatus");
const instanceSelect = document.getElementById("instanceSelect");
const instanceStatus = document.getElementById("instanceStatus");
const refreshInstancesBtn = document.getElementById("refreshInstancesBtn");

// Load saved config and validate session
chrome.storage.local.get(["apiUrl", "authToken", "selectedInstance", "selectedWorkspace"], async (result) => {
  if (result.apiUrl) apiUrlInput.value = result.apiUrl;
  if (result.authToken) {
    // Validate session before showing logged state
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "validate-session" }, (resp) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (resp && resp.error) reject(new Error(resp.error));
          else resolve(resp);
        });
      });
      // Session valid
      loginSection.classList.remove("show");
      loggedSection.classList.add("show");
      loadWorkspaces(result.selectedWorkspace, result.selectedInstance);
    } catch (err) {
      // Session invalid — force login
      showStatus("Sessão expirada. Faça login novamente.", "error");
      loginSection.classList.add("show");
      loggedSection.classList.remove("show");
    }
  }
});

// Login
loginBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!apiUrl || !email || !password) {
    showStatus("Preencha todos os campos", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  try {
    // Try the entered URL first, then auto-correct common mistakes
    const urlsToTry = [apiUrl];
    if (apiUrl.includes("://app.")) {
      urlsToTry.push(apiUrl.replace("://app.", "://api."));
    }

    let data = null;
    let workingUrl = null;

    for (const tryUrl of urlsToTry) {
      try {
        const res = await fetch(`${tryUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: "anon" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err.error_description || err.msg || `HTTP ${res.status}`;
          if (res.status === 405 && urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) continue;
          throw new Error(msg);
        }

        data = await res.json();
        workingUrl = tryUrl;
        break;
      } catch (err) {
        if (urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) continue;
        throw err;
      }
    }

    if (!data || !data.access_token) throw new Error("Token não recebido");

    if (workingUrl && workingUrl !== apiUrl) apiUrlInput.value = workingUrl;
    const finalUrl = workingUrl || apiUrl;

    await chrome.storage.local.set({
      apiUrl: finalUrl,
      authToken: data.access_token,
      refreshToken: data.refresh_token,
    });

    showStatus("Conectado com sucesso!", "success");
    loginSection.classList.remove("show");
    loggedSection.classList.add("show");
    loadWorkspaces();
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance", "selectedWorkspace"]);
  loginSection.classList.add("show");
  loggedSection.classList.remove("show");
  showStatus("Desconectado", "success");
});

// Save API URL on change
apiUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim().replace(/\/+$/, "") });
});

// Workspace selection
workspaceSelect.addEventListener("change", () => {
  const val = workspaceSelect.value;
  if (val) {
    const name = workspaceSelect.options[workspaceSelect.selectedIndex].textContent;
    const workspace = { id: val, name };
    chrome.storage.local.set({ selectedWorkspace: workspace });
    workspaceStatus.innerHTML = `<div class="workspace-badge">🏢 ${name}</div>`;
    // Reload instances for this workspace
    loadInstances();
  } else {
    chrome.storage.local.remove(["selectedWorkspace"]);
    workspaceStatus.innerHTML = "";
    instanceSelect.innerHTML = '<option value="">Selecione um workspace primeiro</option>';
    instanceSelect.disabled = true;
    instanceStatus.innerHTML = "";
  }
});

// Instance selection
instanceSelect.addEventListener("change", () => {
  const val = instanceSelect.value;
  if (val) {
    const instance = { instance_name: val };
    chrome.storage.local.set({ selectedInstance: instance });
    instanceStatus.innerHTML = `<div class="instance-status"><span class="dot"></span> ${val} selecionada</div>`;
  } else {
    chrome.storage.local.remove(["selectedInstance"]);
    instanceStatus.innerHTML = "";
  }
});

// Refresh button
refreshInstancesBtn.addEventListener("click", () => {
  loadWorkspaces();
});

// Load workspaces from API via background
async function loadWorkspaces(savedWorkspace, savedInstance) {
  workspaceSelect.disabled = true;
  workspaceSelect.innerHTML = '<option value="">Carregando...</option>';
  workspaceStatus.innerHTML = '<div class="instance-loading">Buscando workspaces...</div>';

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "list-workspaces" }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (response && response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });

    const workspaces = result.workspaces || [];

    if (workspaces.length === 0) {
      workspaceSelect.innerHTML = '<option value="">Nenhum workspace encontrado</option>';
      workspaceStatus.innerHTML = '<div class="instance-loading">Crie um workspace na aplicação primeiro</div>';
      return;
    }

    workspaceSelect.innerHTML = '<option value="">Selecione um workspace</option>';
    workspaces.forEach((ws) => {
      const opt = document.createElement("option");
      opt.value = ws.id;
      opt.textContent = ws.name;
      workspaceSelect.appendChild(opt);
    });

    workspaceSelect.disabled = false;

    // Auto-select if only one workspace
    if (workspaces.length === 1 && !savedWorkspace) {
      workspaceSelect.value = workspaces[0].id;
      const workspace = { id: workspaces[0].id, name: workspaces[0].name };
      chrome.storage.local.set({ selectedWorkspace: workspace });
      workspaceStatus.innerHTML = `<div class="workspace-badge">🏢 ${workspaces[0].name}</div>`;
      loadInstances(savedInstance);
    } else if (savedWorkspace && savedWorkspace.id) {
      const exists = workspaces.find((w) => w.id === savedWorkspace.id);
      if (exists) {
        workspaceSelect.value = savedWorkspace.id;
        workspaceStatus.innerHTML = `<div class="workspace-badge">🏢 ${exists.name}</div>`;
        loadInstances(savedInstance);
      } else {
        workspaceStatus.innerHTML = '<div class="instance-loading">Workspace anterior não encontrado. Selecione outro.</div>';
        chrome.storage.local.remove(["selectedWorkspace"]);
      }
    } else {
      workspaceStatus.innerHTML = "";
    }
  } catch (err) {
    if (err.message.includes("expirada") || err.message.includes("login")) {
      loginSection.classList.add("show");
      loggedSection.classList.remove("show");
    }
    workspaceSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    workspaceStatus.innerHTML = `<div class="instance-loading" style="color:#dc2626;">${err.message}</div>`;
  }
}

// Load instances for selected workspace
async function loadInstances(savedInstance) {
  instanceSelect.disabled = true;
  instanceSelect.innerHTML = '<option value="">Carregando...</option>';
  instanceStatus.innerHTML = '<div class="instance-loading">Buscando instâncias...</div>';

  const workspaceId = workspaceSelect.value;
  if (!workspaceId) {
    instanceSelect.innerHTML = '<option value="">Selecione um workspace primeiro</option>';
    instanceStatus.innerHTML = "";
    return;
  }

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "list-instances", workspaceId }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (response && response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });

    const instances = result.instances || [];

    if (instances.length === 0) {
      instanceSelect.innerHTML = '<option value="">Nenhuma instância encontrada</option>';
      instanceStatus.innerHTML = '<div class="instance-loading">Conecte uma instância na aplicação primeiro</div>';
      return;
    }

    instanceSelect.innerHTML = '<option value="">Selecione uma instância</option>';
    instances.forEach((inst) => {
      const opt = document.createElement("option");
      opt.value = inst.instance_name;
      opt.textContent = `${inst.instance_name} (${inst.status || "ativo"})`;
      instanceSelect.appendChild(opt);
    });

    instanceSelect.disabled = false;

    // Restore saved selection
    const saved = savedInstance || null;
    if (saved && saved.instance_name) {
      const exists = instances.find((i) => i.instance_name === saved.instance_name);
      if (exists) {
        instanceSelect.value = saved.instance_name;
        instanceStatus.innerHTML = `<div class="instance-status"><span class="dot"></span> ${saved.instance_name} selecionada</div>`;
      } else {
        instanceStatus.innerHTML = '<div class="instance-loading">Instância anterior não encontrada. Selecione outra.</div>';
        chrome.storage.local.remove(["selectedInstance"]);
      }
    } else {
      instanceStatus.innerHTML = "";
    }
  } catch (err) {
    if (err.message.includes("expirada") || err.message.includes("login")) {
      loginSection.classList.add("show");
      loggedSection.classList.remove("show");
    }
    instanceSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    instanceStatus.innerHTML = `<div class="instance-loading" style="color:#dc2626;">${err.message}</div>`;
  }
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type;
  setTimeout(() => { statusEl.textContent = ""; }, 4000);
}
