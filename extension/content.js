const PANEL_ID = "__bo1_direct_pad_picker_v1";
let assignedPad = null;
let statusText = "Elige un control para esta ventana.";
let latestPadStatus = "";

showPicker();
registerWithWorker();

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== "bo1-direct-pad" || event.data.type !== "pad-status") return;
  if (event.data.player !== assignedPad || assignedPad == null) return;
  const playerLabel = `Control ${assignedPad + 1}`;
  let nextStatus;
  if (event.data.error) {
    nextStatus = `${playerLabel} asignado · Edge bloqueó la lectura del mando.`;
  } else if (!event.data.connected) {
    nextStatus = `${playerLabel} asignado · mando no detectado; pulsa un botón aquí.`;
  } else {
    const pressed = event.data.buttons.findIndex(Boolean);
    nextStatus = pressed >= 0
      ? `${playerLabel} detectado · Botón ${pressed + 1} pulsado.`
      : `${playerLabel} detectado · mueve un stick o pulsa un botón.`;
  }
  if (nextStatus !== latestPadStatus) {
    latestPadStatus = nextStatus;
    statusText = nextStatus;
    showPicker();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "assign") {
    assignedPad = Number.isInteger(message.player) ? message.player : null;
    latestPadStatus = "";
    statusText = assignedPad == null
      ? "Elige un control para esta ventana."
      : `Control ${assignedPad + 1} seleccionado · pulsa un botón de ese mando.`;
    showPicker();
    window.postMessage({ source: "bo1-direct-pad", type: "assign", player: assignedPad }, location.origin);
    sendResponse({ ok: true, pad: assignedPad });
  }
  return false;
});

function showPicker() {
  if (!document.documentElement) {
    document.addEventListener("DOMContentLoaded", showPicker, { once: true });
    return;
  }

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: "fixed", left: "12px", bottom: "12px", zIndex: "2147483647",
      display: "flex", flexDirection: "column", gap: "7px", minWidth: "245px",
      padding: "9px", borderRadius: "10px", background: "#111e", color: "white",
      boxShadow: "0 2px 12px #0009", font: "600 12px/1.25 system-ui, sans-serif",
      pointerEvents: "auto",
    });
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "6px" });
    const controlOne = makeButton("Control 1");
    const controlTwo = makeButton("Control 2");
    controlOne.dataset.pad = "0";
    controlTwo.dataset.pad = "1";
    controlOne.addEventListener("click", () => choosePad(0));
    controlTwo.addEventListener("click", () => choosePad(1));
    row.append(controlOne, controlTwo);
    const help = makeButton("Ayuda / dividir pantalla");
    help.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "open-help" }).catch(() => {
        statusText = "No se pudo abrir la ayuda.";
        showPicker();
      });
    });
    help.style.background = "#344154";
    const status = document.createElement("div");
    status.dataset.status = "true";
    status.style.color = "#c9d5e6";
    panel.append(row, help, status);
    document.documentElement.append(panel);
  }

  panel.querySelectorAll("button[data-pad]").forEach((button) => {
    const pad = Number(button.dataset.pad);
    const selected = assignedPad === pad;
    button.style.background = selected ? (pad === 0 ? "#16854b" : "#245ab5") : "#303b4c";
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const status = panel.querySelector("[data-status]");
  if (status) status.textContent = statusText;
}

function makeButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    flex: "1", padding: "7px 10px", border: "0", borderRadius: "7px",
    color: "white", background: "#303b4c", cursor: "pointer", font: "inherit",
    whiteSpace: "nowrap",
  });
  return button;
}

async function choosePad(pad) {
  const buttons = document.querySelectorAll(`#${PANEL_ID} button[data-pad]`);
  buttons.forEach((button) => { button.disabled = true; });
  statusText = `Asignando Control ${pad + 1}...`;
  showPicker();
  try {
    const response = await chrome.runtime.sendMessage({ type: "select-pad", pad });
    if (!response?.ok) {
      statusText = response?.error || "No se pudo asignar el control. Recarga esta ventana.";
      showPicker();
      return;
    }
    assignedPad = response.pad;
    latestPadStatus = "";
    statusText = `Control ${pad + 1} seleccionado · pulsa un botón de ese mando.`;
    showPicker();
  } catch {
    statusText = "No se pudo contactar la extensión. Recarga esta ventana.";
    showPicker();
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function registerWithWorker() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "hello" });
      if (response?.ok) {
        assignedPad = Number.isInteger(response.pad) ? response.pad : null;
        statusText = assignedPad == null
          ? "Elige un control para esta ventana."
          : `Control ${assignedPad + 1} seleccionado · pulsa un botón de ese mando.`;
        showPicker();
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  statusText = "Extensión desconectada. Recarga esta ventana.";
  showPicker();
}
