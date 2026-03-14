// ── Simplificando Conversas — Popup Config ──

const apiUrlInput = document.getElementById("apiUrl");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const loginSection = document.getElementById("loginSection");
const loggedSection = document.getElementById("loggedSection");

// Load saved config
chrome.storage.local.get(["apiUrl", "authToken"], (result) => {
  if (result.apiUrl) apiUrlInput.value = result.apiUrl;
  if (result.authToken) {
    loginSection.classList.remove("show");
    loggedSection.classList.add("show");
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
    // Authenticate via GoTrue (same as supabase auth)
    const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: "anon", // will be replaced by nginx, just needs to be present
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
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["authToken", "refreshToken"]);
  loginSection.classList.add("show");
  loggedSection.classList.remove("show");
  showStatus("Desconectado", "success");
});

// Save API URL on change
apiUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim().replace(/\/+$/, "") });
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type;
  setTimeout(() => { statusEl.textContent = ""; }, 4000);
}
