// ── Simplificando Conversas — Popup Config ──

const apiUrlInput = document.getElementById("apiUrl");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const loginSection = document.getElementById("loginSection");
const loggedSection = document.getElementById("loggedSection");
const instanceSelect = document.getElementById("instanceSelect");
const instanceStatus = document.getElementById("instanceStatus");
const refreshInstancesBtn = document.getElementById("refreshInstancesBtn");

// Load saved config and validate session
chrome.storage.local.get(["apiUrl", "authToken", "selectedInstance"], async (result) => {
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
      loadInstances(result.selectedInstance);
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

    // If user entered app.domain, also try api.domain
    if (apiUrl.includes("://app.")) {
      urlsToTry.push(apiUrl.replace("://app.", "://api."));
    }
    // If user entered just the domain without app/api prefix, try api.
    if (!apiUrl.includes("://app.") && !apiUrl.includes("://api.")) {
      const urlObj = new URL(apiUrl);
      urlsToTry.push(`${urlObj.protocol}//api.${urlObj.host}${urlObj.pathname}`);
    }

    let lastError = null;
    let data = null;
    let workingUrl = null;

    for (const tryUrl of urlsToTry) {
      try {
        const res = await fetch(`${tryUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: "anon",
          },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err.error_description || err.msg || `HTTP ${res.status}`;
          // 405 means wrong URL entirely, keep trying
          if (res.status === 405 && urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) {
            lastError = new Error(msg);
            continue;
          }
          throw new Error(msg);
        }

        data = await res.json();
        workingUrl = tryUrl;
        break;
      } catch (err) {
        lastError = err;
        // Network errors or 405: try next URL
        if (urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) continue;
        throw err;
      }
    }

    if (!data || !data.access_token) {
      throw lastError || new Error("Token não recebido");
    }

    // Update the input to show the correct working URL
    if (workingUrl && workingUrl !== apiUrl) {
      apiUrlInput.value = workingUrl;
    }
    const finalUrl = workingUrl || apiUrl;

    await chrome.storage.local.set({ apiUrl: finalUrl, authToken: data.access_token, refreshToken: data.refresh_token });
    showStatus("Conectado com sucesso!", "success");
    loginSection.classList.remove("show");
    loggedSection.classList.add("show");
    loadInstances();
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["authToken", "refreshToken", "selectedInstance"]);
  loginSection.classList.add("show");
  loggedSection.classList.remove("show");
  showStatus("Desconectado", "success");
});

// Save API URL on change
apiUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim().replace(/\/+$/, "") });
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

// Refresh instances button
refreshInstancesBtn.addEventListener("click", () => {
  loadInstances();
});

// Load instances from API via background
async function loadInstances(savedInstance) {
  instanceSelect.disabled = true;
  instanceSelect.innerHTML = '<option value="">Carregando...</option>';
  instanceStatus.innerHTML = '<div class="instance-loading">Buscando instâncias...</div>';

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "list-instances" }, (response) => {
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
    // If session expired, show login
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
