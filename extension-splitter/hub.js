const windowsElement = document.getElementById("windows");
const windowCount = document.getElementById("window-count");
const notice = document.getElementById("notice");

document.getElementById("arrange").addEventListener("click", async () => {
  try {
    const result = await chrome.runtime.sendMessage({
      type: "arrange",
      screen: { width: window.screen.availWidth, height: window.screen.availHeight },
    });
    notice.textContent = result?.ok ? "Ventanas acomodadas lado a lado." : result?.error || "No pude acomodar las ventanas.";
  } catch (error) {
    notice.textContent = `No pude acomodar las ventanas: ${error.message}`;
  }
});

document.getElementById("refresh").addEventListener("click", refreshWindows);

async function refreshWindows() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "status" });
    const tabs = response?.tabs ?? [];
    windowCount.textContent = `${tabs.length}`;
    windowsElement.replaceChildren();
    if (!tabs.length) {
      windowsElement.className = "list empty";
      windowsElement.textContent = "Abre una ventana de vel.gg/bsz.";
      return;
    }
    windowsElement.className = "list";
    for (const tab of tabs) {
      const row = document.createElement("div");
      row.className = "game-window";
      const info = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = tab.player == null ? "Sin control seleccionado" : `Control ${tab.player + 1}`;
      const small = document.createElement("small");
      small.textContent = tab.title;
      info.append(strong, small);
      const state = document.createElement("span");
      state.className = `status ${tab.connected ? "" : "waiting"}`;
      state.textContent = tab.connected ? (tab.player == null ? "lista" : "seleccionado") : "recarga la página";
      row.append(info, state);
      windowsElement.append(row);
    }
  } catch (error) {
    notice.textContent = `No pude consultar las ventanas: ${error.message}`;
  }
}

refreshWindows();
setInterval(refreshWindows, 1500);
