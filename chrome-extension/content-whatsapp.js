// ── Simplificando Conversas — WhatsApp Web DOM Manipulation ──
// Receives commands from background.js and manipulates WhatsApp Web DOM
// Single-path approach: New Chat button → type number → click result
// Based on Finance Hub v7.4

(function () {
  const TAG = "[SC-WhatsApp-DOM]";

  console.log(TAG, "Content script carregado (v1.0 - DOM manipulation)");

  // ── Tell background we're ready ──
  chrome.runtime.sendMessage({ action: "WHATSAPP_READY" });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── DOM helpers ──
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function cleanPhone(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  // ── Step 1: Find and click "New Chat" button ──
  function findNewChatButton() {
    const selectors = [
      '[data-testid="chatlist-header-new-chat-button"]',
      'button[aria-label*="Nova conversa"]',
      'button[aria-label*="New chat"]',
      'span[data-icon="new-chat-outline"]',
      'span[data-icon="new-chat"]',
      'button[aria-label*="Novo chat"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el.closest("button") || el;
    }
    return null;
  }

  // ── Step 2: Find search input ──
  function findSearchInput() {
    const ariaLabels = [
      'div[contenteditable="true"][aria-label*="Pesquisar"]',
      'div[contenteditable="true"][aria-label*="Search"]',
      'div[contenteditable="true"][aria-label*="Buscar"]',
      'input[aria-label*="Pesquisar"]',
      'input[aria-label*="Search"]',
    ];
    for (const sel of ariaLabels) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.left > window.innerWidth * 0.65) continue;
        if (rect.top > window.innerHeight * 0.4) continue;
        return el;
      }
    }
    return null;
  }

  function waitForElement(finder, timeout = 3000) {
    return new Promise((resolve) => {
      const existing = finder();
      if (existing) { resolve(existing); return; }
      let done = false;
      const observer = new MutationObserver(() => {
        if (done) return;
        const el = finder();
        if (!el) return;
        done = true;
        observer.disconnect();
        resolve(el);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { if (done) return; done = true; observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // ── Insert text into search field ──
  async function typeInSearchField(el, text) {
    if (!el) return false;

    console.log(TAG, "Attempting to type:", text);

    await sleep(500);
    el.focus();
    await sleep(500);

    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    } catch (e) {
      console.error(TAG, "execCommand failed:", e);
    }

    if ((el.textContent || "").trim() !== text) {
      el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
      while (el.firstChild) el.removeChild(el.firstChild);
      const textNode = document.createTextNode(text);
      el.appendChild(textNode);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    }

    await sleep(500);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));

    await sleep(500);
    const content = (el.textContent || "").trim();
    return content.includes(text) || content.length > 0;
  }

  // ── Step 3: Find and click first result (strict match) ──
  function findFirstResult(targetPhone) {
    const searchInput = findSearchInput();
    const searchRect = searchInput?.getBoundingClientRect();
    const searchBottom = searchRect?.bottom || 0;

    const blocked = [
      "novo grupo", "novo contato", "nova comunidade",
      "new group", "new contact", "new community",
      "pesquisar nome ou número", "search name or number",
      "não está na sua lista de contatos", "not in your contacts",
    ];

    const cleanTarget = cleanPhone(targetPhone);
    const allDivs = document.querySelectorAll("div");

    for (const div of allDivs) {
      if (!isVisible(div)) continue;
      const rect = div.getBoundingClientRect();
      if (rect.top < searchBottom - 5 || rect.left > window.innerWidth * 0.65) continue;

      const text = (div.textContent || "").trim();
      const lowerText = text.toLowerCase();

      // Skip blocked results
      if (blocked.some((b) => lowerText.includes(b))) continue;

      const cleanText = cleanPhone(text);

      // Check if the element text contains our target phone number
      if (cleanText.includes(cleanTarget) && cleanText.length >= 8) {
        const clickable = div.closest('[role="button"]') || div.closest('[data-testid="cell-frame-container"]') || div;
        if (clickable && clickable !== document.body) {
          console.log(TAG, "Found result matching target phone:", text.substring(0, 20));
          return clickable;
        }
      }
    }

    return null;
  }

  function findMessageInput() {
    const selectors = [
      '[data-testid="conversation-compose-box-input"]',
      'footer div[contenteditable="true"][role="textbox"]',
      'footer div[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (isVisible(el)) return el;
    }
    return null;
  }

  // ── Main: openChat ──
  async function openChat(phoneRaw) {
    const phone = cleanPhone(phoneRaw);
    if (!phone) return { success: false, error: "invalid_phone" };

    console.log(TAG, "openChat:", phone);

    const btn = findNewChatButton();
    if (!btn) {
      const alreadyOpen = findSearchInput();
      if (!alreadyOpen) return { success: false, error: "new_chat_button_not_found" };
    } else {
      btn.click();
      console.log(TAG, "Step 1: New chat button clicked");
    }

    await sleep(800);

    const searchInput = await waitForElement(findSearchInput, 4000);
    if (!searchInput) return { success: false, error: "search_input_not_found" };

    await typeInSearchField(searchInput, phone);
    console.log(TAG, "Step 2: Number typed:", phone);

    // Wait for results to load
    await sleep(3000);

    const result = findFirstResult(phone);
    if (!result) {
      console.log(TAG, "Step 3: No matching result found for", phone);
      return { success: false, error: "no_matching_result_found" };
    }

    console.log(TAG, "Step 3: Clicking matching result");
    await sleep(500);
    result.click();

    const inner = result.querySelector('div[role="button"]') || result.querySelector('[data-testid="cell-frame-container"]');
    if (inner) {
      await sleep(200);
      inner.click();
    }

    const msgInput = await waitForElement(findMessageInput, 5000);
    if (msgInput) {
      console.log(TAG, "✓ Chat opened successfully");
      return { success: true, method: "dom" };
    }

    return { success: false, error: "chat_did_not_open" };
  }

  // ── prepareText: open chat and insert text ──
  async function prepareText(phone, text) {
    const opened = await openChat(phone);
    if (!opened.success) return opened;
    await sleep(500);
    const input = await waitForElement(findMessageInput, 3000);
    if (!input) return { success: false, error: "message_input_not_found" };
    input.focus();
    await sleep(200);
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { success: true };
  }

  // ── prepareImage: open chat and attach image ──
  async function prepareImage(phone, imageDataUrl) {
    const opened = await openChat(phone);
    if (!opened.success) return opened;
    await sleep(500);
    const attach =
      document.querySelector('[data-testid="attach-menu"]') ||
      document.querySelector('div[title="Anexar"]') ||
      document.querySelector('span[data-icon="plus"]');
    if (!attach) return { success: false, error: "attach_button_not_found" };
    (attach.closest("button") || attach).click();
    await sleep(500);
    const input = document.querySelector('input[accept*="image"]');
    if (!input) return { success: false, error: "image_input_not_found" };
    const blob = await fetch(imageDataUrl).then((r) => r.blob());
    const file = new File([blob], "image.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true };
  }

  // ── Listen for commands from background ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(TAG, "Comando recebido:", message.action || message.type);
    const action = message.action || message.type;

    if (action === "OPEN_CHAT") {
      const phone = message.phone || message.phoneNumber || message.number;
      if (!phone) { sendResponse({ success: false, error: "phone_missing" }); return true; }
      openChat(phone).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (action === "SEND_TEXT") {
      prepareText(message.phone, message.text).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (action === "SEND_IMAGE") {
      prepareImage(message.phone, message.imageDataUrl || message.imageUrl).then((r) => sendResponse(r)).catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (action === "HEARTBEAT") {
      sendResponse({ alive: true });
      return;
    }

    return false;
  });

  // ── Heartbeat: announce readiness every 5s ──
  setInterval(() => {
    if (document.visibilityState === "visible") {
      chrome.runtime.sendMessage({ action: "WHATSAPP_READY" });
    }
  }, 5000);
})();
