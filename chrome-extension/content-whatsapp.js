// ── Simplificando Conversas — WhatsApp Web DOM Manipulation ──
// Receives commands from background.js and manipulates WhatsApp Web DOM
// Runs on https://web.whatsapp.com/*

(function () {
  const TAG = "[SC-WhatsApp-DOM]";

  console.log(TAG, "WhatsApp DOM controller loaded");

  // ── Tell background we're ready ──
  function announceReady() {
    chrome.runtime.sendMessage({ action: "WHATSAPP_READY" });
  }
  announceReady();
  setInterval(announceReady, 5000);

  // ── Helpers ──
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitForElement(selector, parent = document, timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = parent.querySelector(selector);
      if (el) return el;
      await sleep(200);
    }
    return null;
  }

  function simulateInput(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ── Open a chat by phone number ──
  async function openChat(phone) {
    console.log(TAG, "Opening chat for:", phone);

    // Method 1: Use wa.me link (most reliable)
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanPhone}`, "_self");
      await sleep(2000);
      return { success: true, method: "wa.me" };
    } catch (err) {
      console.warn(TAG, "wa.me method failed:", err);
    }

    // Method 2: Use the "New Chat" button
    try {
      const newChatBtn = document.querySelector('[data-icon="new-chat-outline"]');
      if (newChatBtn) {
        newChatBtn.closest("button, div[role='button'], [tabindex]")?.click();
        await sleep(800);

        const searchInput = await waitForElement(
          'div[contenteditable="true"][data-tab="3"]'
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.textContent = phone;
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(1500);

          // Click on the first result
          const result = await waitForElement(
            'div[data-testid="cell-frame-container"]'
          );
          if (result) {
            result.click();
            await sleep(500);
            return { success: true, method: "search" };
          }
        }
      }
    } catch (err) {
      console.warn(TAG, "New chat method failed:", err);
    }

    return { success: false, error: "Could not open chat" };
  }

  // ── Prepare text in the input box (after opening chat) ──
  async function prepareText(phone, text) {
    console.log(TAG, "Preparing text for:", phone);

    // First open the chat
    const chatResult = await openChat(phone);
    if (!chatResult.success) {
      return chatResult;
    }

    await sleep(1000);

    // Find the message input
    const msgInput = await waitForElement(
      'div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][data-tab="6"], footer div[contenteditable="true"]'
    );

    if (!msgInput) {
      return { success: false, error: "Message input not found" };
    }

    // Insert text
    msgInput.focus();
    
    // Handle multi-line text
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        // Shift+Enter for new line
        msgInput.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            shiftKey: true,
            bubbles: true,
          })
        );
        await sleep(50);
      }
      document.execCommand("insertText", false, lines[i]);
      await sleep(50);
    }

    return { success: true, method: "text-prepared" };
  }

  // ── Prepare image (paste from data URL) ──
  async function prepareImage(phone, imageDataUrl) {
    console.log(TAG, "Preparing image for:", phone);

    const chatResult = await openChat(phone);
    if (!chatResult.success) {
      return chatResult;
    }

    await sleep(1000);

    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // Create a File object
      const file = new File([blob], "image.png", { type: blob.type });

      // Find the attachment button or use paste
      const msgInput = await waitForElement(
        'div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][data-tab="6"], footer div[contenteditable="true"]'
      );

      if (msgInput) {
        msgInput.focus();
        await sleep(300);

        // Use clipboard API to paste
        const clipboardData = new DataTransfer();
        clipboardData.items.add(file);
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: clipboardData,
          bubbles: true,
          cancelable: true,
        });
        msgInput.dispatchEvent(pasteEvent);

        return { success: true, method: "image-pasted" };
      }
    } catch (err) {
      console.warn(TAG, "Image paste failed:", err);
    }

    return { success: false, error: "Could not paste image" };
  }

  // ── Listen for commands from background ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;

    if (action === "OPEN_CHAT") {
      openChat(message.phone).then(sendResponse);
      return true; // async
    }

    if (action === "SEND_TEXT") {
      prepareText(message.phone, message.text).then(sendResponse);
      return true;
    }

    if (action === "SEND_IMAGE") {
      prepareImage(message.phone, message.imageDataUrl).then(sendResponse);
      return true;
    }

    if (action === "HEARTBEAT") {
      sendResponse({ alive: true });
      return;
    }
  });
})();
