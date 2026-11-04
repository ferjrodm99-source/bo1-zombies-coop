const nativeGetGamepads = typeof navigator.getGamepads === "function"
  ? navigator.getGamepads.bind(navigator)
  : () => [];

let assignedPad = null;
window.__bo1DirectPadFilterActive = true;

Object.defineProperty(navigator, "getGamepads", {
  configurable: true,
  value() {
    if (assignedPad !== 0 && assignedPad !== 1) return emptyGamepads();
    let physicalPads;
    try {
      physicalPads = nativeGetGamepads();
    } catch {
      return emptyGamepads();
    }
    const physical = physicalPads?.[assignedPad];
    if (!physical?.connected) return emptyGamepads();
    const result = [makeVirtualPad(physical)];
    Object.defineProperty(result, "item", { value: (index) => result[index] ?? null });
    return result;
  },
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== "bo1-direct-pad") return;
  if (event.data.type === "probe") {
    publishPadStatus();
    return;
  }
  if (event.data.type !== "assign") return;
  assignedPad = Number.isInteger(event.data.player) ? event.data.player : null;
  try {
    window.__bo1Coop?.gamepad?.update?.(performance.now());
  } catch {}
  publishPadStatus();
});

window.addEventListener("gamepadconnected", publishPadStatus);
window.addEventListener("gamepaddisconnected", publishPadStatus);
setInterval(publishPadStatus, 180);

function publishPadStatus() {
  if (assignedPad !== 0 && assignedPad !== 1) return;
  let physical = null;
  let error = false;
  try {
    physical = nativeGetGamepads()?.[assignedPad] ?? null;
  } catch {
    error = true;
  }
  const buttons = Array.from(physical?.buttons ?? [], (button) => Boolean(button.pressed || button.value > 0.5));
  window.postMessage({
    source: "bo1-direct-pad",
    type: "pad-status",
    player: assignedPad,
    connected: Boolean(physical?.connected),
    error,
    buttons,
  }, location.origin);
}

function emptyGamepads() {
  const result = [];
  Object.defineProperty(result, "item", { value: () => null });
  return result;
}

function makeVirtualPad(physical) {
  const buttons = Array.from(physical.buttons ?? [], (button) => ({
    pressed: Boolean(button.pressed),
    touched: Boolean(button.touched || button.pressed || button.value > 0),
    value: Number(button.value) || 0,
  }));
  return {
    id: String(physical.id || "Direct Window Controller"),
    index: 0,
    connected: true,
    timestamp: Number(physical.timestamp) || performance.now(),
    mapping: physical.mapping === "standard" ? "standard" : "standard",
    axes: Float32Array.from(physical.axes ?? []),
    buttons,
    vibrationActuator: null,
    hapticActuators: [],
  };
}
