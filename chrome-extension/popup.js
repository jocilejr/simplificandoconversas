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

// Load saved config
chrome.storage.local.get(["apiUrl", "authToken", "selectedInstance"], (result) => {
  if (result.apiUrl) apiUrlInput.value = result.apiUrl;
  if (result.authToken) {
    loginSection.classList.remove("show");
    loggedSection.classList.add("show");
    loadInstances(result.selectedInstance);
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
    const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: "anon",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const token = data.access_token;

    if (!token) throw new Error("Token não recebido");

    await chrome.storage.local.set({ apiUrl, authToken: token, refreshToken: data.refresh_token });
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
    instanceSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    instanceStatus.innerHTML = `<div class="instance-loading" style="color:#dc2626;">${err.message}</div>`;
  }
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type;
  setTimeout(() => { statusEl.textContent = ""; }, 4000);
}
