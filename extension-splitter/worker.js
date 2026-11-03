const PAGE_MATCH = "https://vel.gg/bsz*";
const ASSIGNMENTS_KEY = "directWindowPadAssignmentsV1";

let assignments = Object.create(null);
const initialized = chrome.storage.session.get(ASSIGNMENTS_KEY).then((saved) => {
  const value = saved[ASSIGNMENTS_KEY];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    assignments = Object.assign(Object.create(null), value);
  }
});

chrome.action.onClicked.addListener(() => openHelp());

async function openHelp() {
  const url = chrome.runtime.getURL("hub.html");
  const windows = await chrome.windows.getAll({ populate: true });
  const existing = windows.flatMap((win) => win.tabs ?? []).find((tab) => tab.url === url);
  if (existing?.windowId != null) {
    await chrome.windows.update(existing.windowId, { focused: true });
    await chrome.tabs.update(existing.id, { active: true });
    return { ok: true };
  }
  await chrome.windows.create({ url, type: "popup", width: 420, height: 560, focused: true });
  return { ok: true };
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!Object.hasOwn(assignments, tabId)) return;
  delete assignments[tabId];
  saveAssignments();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || matchesGame(changeInfo.url) || !Object.hasOwn(assignments, tabId)) return;
  delete assignments[tabId];
  saveAssignments();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (message?.type === "open-help") {
    openHelp().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "hello" && Number.isInteger(tabId)) {
    registerTab(tabId).then(sendResponse);
    return true;
  }
  if (message?.type === "select-pad" && Number.isInteger(tabId)) {
    selectPad(tabId, message.pad).then(sendResponse);
    return true;
  }
  if (message?.type === "status") {
    getStatus().then(sendResponse);
    return true;
  }
  if (message?.type === "arrange") {
    arrangeWindows(message.screen).then(sendResponse);
    return true;
  }
  return false;
});

async function registerTab(tabId) {
  await initialized;
  if (!Object.hasOwn(assignments, tabId)) assignments[tabId] = null;
  const connected = await sendAssignment(tabId);
  return { ok: true, pad: assignments[tabId], connected };
}

async function selectPad(tabId, pad) {
  await initialized;
  if (pad !== 0 && pad !== 1) return { ok: false, error: "Elige Control 1 o Control 2." };
  assignments[tabId] = pad;
  await saveAssignments();
  const connected = await sendAssignment(tabId);
  return { ok: connected, pad, error: connected ? undefined : "Recarga esta ventana y vuelve a elegir el control." };
}

async function sendAssignment(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "assign",
      player: Number.isInteger(assignments[tabId]) ? assignments[tabId] : null,
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

async function getStatus() {
  await initialized;
  const tabs = await chrome.tabs.query({ url: PAGE_MATCH });
  const status = await Promise.all(tabs.map(async (tab) => ({
    id: tab.id,
    title: tab.title || "vel.gg",
    player: Number.isInteger(assignments[tab.id]) ? assignments[tab.id] : null,
    connected: await sendAssignment(tab.id),
  })));
  status.sort((a, b) => (a.player ?? 99) - (b.player ?? 99) || a.id - b.id);
  return { tabs: status };
}

async function arrangeWindows(screen) {
  const width = Math.floor(Number(screen?.width));
  const height = Math.floor(Number(screen?.height));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 600 || height < 400) {
    return { ok: false, error: "No pude leer el tamaño de la pantalla." };
  }

  await initialized;
  const tabs = await chrome.tabs.query({ url: PAGE_MATCH });
  const playerOne = tabs.filter((tab) => assignments[tab.id] === 0);
  const playerTwo = tabs.filter((tab) => assignments[tab.id] === 1);
  if (playerOne.length !== 1 || playerTwo.length !== 1) {
    return { ok: false, error: "Asigna Control 1 a una ventana y Control 2 a la otra." };
  }
  if (playerOne[0].windowId === playerTwo[0].windowId) {
    return { ok: false, error: "Abre cada jugador en una ventana separada." };
  }

  const half = Math.floor(width / 2);
  await Promise.all([
    chrome.windows.update(playerOne[0].windowId, { left: 0, top: 0, width: half, height }),
    chrome.windows.update(playerTwo[0].windowId, { left: half, top: 0, width: width - half, height }),
  ]);
  return { ok: true };
}

async function saveAssignments() {
  await chrome.storage.session.set({ [ASSIGNMENTS_KEY]: assignments });
}

function matchesGame(url) {
  return typeof url === "string" && /^https:\/\/vel\.gg\/bsz(?:[/?#]|$)/i.test(url);
}
