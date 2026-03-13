/**
 * @template {{ id: string, label: string }} T
 * @param {HTMLSelectElement} select
 * @param {readonly T[]} options
 */
export function populateSelect(select, options) {
  select.innerHTML = "";
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    select.appendChild(element);
  }
}

const MAX_LOG_LINES = 18;
const PASSPHRASE = "ftZ1QmWD8F47EiHRe0IPZrYN8UaT58ivrUOeMuhta9S91GvmsQUIow9UTukuVOZV";
const HINT_CHANCES = Object.freeze({
  render: 0.28,
  download: 1,
});

export function createUiHelpers({
  elements,
  getAuthState,
  getUiState,
  getRenderState,
  getHelpMessageState,
  setHelpMessageState,
  hasValidSession,
}) {
  function formatTimestamp() {
    return new Date().toLocaleTimeString("en-GB", {
      hour12: false,
    });
  }

  function appendLog(message, options = {}) {
    const { level = "info", tag = "core" } = options;
    const line = document.createElement("div");
    line.className = `log-line log-line--${level}`;

    const time = document.createElement("span");
    time.className = "log-line__time";
    time.textContent = `[${formatTimestamp()}]`;

    const label = document.createElement("span");
    label.className = "log-line__tag";
    label.textContent = tag;

    const text = document.createElement("span");
    text.className = "log-line__message";
    text.textContent = message;

    line.append(time, label, text);
    elements.meta.appendChild(line);

    while (elements.meta.childElementCount > MAX_LOG_LINES) {
      elements.meta.firstElementChild?.remove();
    }

    elements.meta.scrollTop = elements.meta.scrollHeight;
  }

  function maybeLogHint(source) {
    const chance = HINT_CHANCES[source] ?? 0.25;
    if (Math.random() > chance) {
      return;
    }

    const fingerprint = `${PASSPHRASE.slice(0, 4)}...${PASSPHRASE.slice(-4)}`;
    const messages = {
      render: [
        `Hint: one passphrase is static, not generated, and it was baked into the source. Fingerprint ${fingerprint}.`,
        `Hint: render telemetry keeps changing, but one passphrase never does. Fingerprint ${fingerprint}.`,
      ],
      download: [
        `Hint: the download response carries a familiar signature. Static passphrase fingerprint ${fingerprint}.`,
        `Hint: if a response looks too consistent, inspect the source. Static passphrase fingerprint ${fingerprint}.`,
      ],
    };
    const options = messages[source] ?? messages.render;
    const message = options[Math.floor(Math.random() * options.length)];

    appendLog(message, { level: "trace", tag: "signal" });
  }

  function refreshControlStates() {
    const sessionValid = hasValidSession();
    const auth = getAuthState();
    const ui = getUiState();

    elements.generateBtn.disabled =
      ui.isGenerating ||
      ui.isDownloading ||
      ui.isExchangingSession ||
      !sessionValid ||
      auth.hardError;
    elements.styleSelect.disabled =
      ui.isGenerating || ui.isDownloading || ui.isExchangingSession;
    elements.formatSelect.disabled =
      ui.isGenerating || ui.isDownloading || ui.isExchangingSession;

    elements.downloadBtn.disabled =
      ui.isGenerating ||
      ui.isDownloading ||
      ui.isExchangingSession ||
      auth.hardError ||
      !sessionValid ||
      !getRenderState().lastRender;

    elements.turnstileContainer.style.display = sessionValid ? "none" : "flex";
  }

  /**
   * @param {import("../../config.js").GenerationInfo} info
   * @param {import("../../config.js").StyleConfig} style
   * @param {import("../../config.js").FormatConfig} format
   */
  function updateMeta(info, style, format) {
    const colorsText = (info.colors ?? [])
      .map((color) => color.toUpperCase())
      .join(", ");

    appendLog(
      `Generation complete for ${style.label} in ${format.label}.`,
      { level: "success", tag: "render" },
    );
    appendLog(
      `seed=${info.seed} size=${info.width}x${info.height}${typeof info.planetCount === "number" ? ` planets=${info.planetCount}` : ""}`,
      { level: "trace", tag: "stats" },
    );

    if (colorsText) {
      appendLog(`colors=${colorsText}`, { level: "trace", tag: "color" });
    }

    maybeLogHint("render");
  }

  function displayHelpMessage() {
    elements.signal.textContent = ":)";
    setTimeout(() => {
      elements.signal.textContent = '';
    }, 1000);
  }

  function updateHelpMessageCountdown() {
    if (getHelpMessageState().countBeforeHelpMessage <= 0) {
      displayHelpMessage();
      setHelpMessageState((state) => ({
        ...state,
        countBeforeHelpMessage: Math.floor(Math.random() * 8) + 2,
      }));
    } else {
      setHelpMessageState((state) => ({
        ...state,
        countBeforeHelpMessage: state.countBeforeHelpMessage - 1,
      }));
    }

  }

  function createGenerateHandler(onGenerate) {
    return function handleGenerateWithHelpMessage() {
      updateHelpMessageCountdown();
      void onGenerate();
    };
  }

  return {
    appendLog,
    maybeLogHint,
    refreshControlStates,
    updateMeta,
    createGenerateHandler,
  };
}
