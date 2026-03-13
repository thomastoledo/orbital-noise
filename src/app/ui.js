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

export function createUiHelpers({
  elements,
  getAuthState,
  getUiState,
  getRenderState,
  getHelpMessageState,
  setHelpMessageState,
  hasValidSession,
}) {
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
    const detail = colorsText ? ` | colors=${colorsText}` : "";
    elements.meta.textContent = `${style.label} | ${format.label} | seed=${info.seed}${detail} | passphrase=ftZ1QmWD8F47EiHRe0IPZrYN8UaT58ivrUOeMuhta9S91GvmsQUIow9UTukuVOZV`;
  }

  function displayHelpMessage() {
    elements.signal.textContent = "Please help us.";
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
    refreshControlStates,
    updateMeta,
    createGenerateHandler,
  };
}
