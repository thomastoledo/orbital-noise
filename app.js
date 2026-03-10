import {
  createSeed,
  DENSITY_SETTINGS,
  FORMAT_OPTIONS,
  STYLE_OPTIONS,
} from "./config.js";
import { loadGenerator } from "./generatorRegistry.js";
import {
  SESSION_STORAGE_KEY,
  SESSION_TTL_SECONDS,
  TURNSTILE_SITEKEY,
} from "./src/config.js";
import { renderTurnstile, resetTurnstile } from "./src/security/turnstile.js";
import { getEncryptedEnvelope, getSessionToken } from "./src/api/suntrazApi.js";
import { injectSuntrazChunk } from "./src/suntraz/pngMetadata.js";
import { createGenerateAction, createDownloadAction } from "./src/app/actions.js";
import { createSessionHelpers, createAuthFlow } from "./src/app/session.js";
import { createAppState } from "./src/app/state.js";
import { createUiHelpers, populateSelect } from "./src/app/ui.js";

const elements = {
  /** @type {HTMLCanvasElement} */
  canvas: document.getElementById("wallpaperCanvas"),
  /** @type {HTMLSelectElement} */
  styleSelect: document.getElementById("styleSelect"),
  /** @type {HTMLSelectElement} */
  formatSelect: document.getElementById("formatSelect"),
  /** @type {HTMLButtonElement} */
  generateBtn: document.getElementById("generateBtn"),
  /** @type {HTMLButtonElement} */
  downloadBtn: document.getElementById("downloadBtn"),
  /** @type {HTMLParagraphElement} */
  meta: document.getElementById("meta"),
  /** @type {HTMLDivElement} */
  turnstileContainer: document.getElementById("turnstileContainer"),
  signal: document.getElementById("signal"),
};

const state = createAppState();

const session = createSessionHelpers({
  getAuthState: state.getAuthState,
  setAuthState: state.setAuthState,
  sessionStorageKey: SESSION_STORAGE_KEY,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
});

const ui = createUiHelpers({
  elements,
  getAuthState: state.getAuthState,
  getUiState: state.getUiState,
  getRenderState: state.getRenderState,
  getHelpMessageState: state.getHelpMessageState,
  setHelpMessageState: state.setHelpMessageState,
  hasValidSession: session.hasValidSession,
});

const authFlow = createAuthFlow({
  meta: elements.meta,
  turnstileContainer: elements.turnstileContainer,
  getAuthState: state.getAuthState,
  setAuthState: state.setAuthState,
  setUiState: state.setUiState,
  storeSession: session.storeSession,
  clearSession: session.clearSession,
  clearTurnstileToken: session.clearTurnstileToken,
  hasValidSession: session.hasValidSession,
  refreshControlStates: ui.refreshControlStates,
  turnstileSitekey: TURNSTILE_SITEKEY,
  renderTurnstile,
  resetTurnstile,
  getSessionToken,
});

const { generate } = createGenerateAction({
  elements,
  setUiState: state.setUiState,
  setRenderState: state.setRenderState,
  hasValidSession: session.hasValidSession,
  refreshControlStates: ui.refreshControlStates,
  updateMeta: ui.updateMeta,
  createSeed,
  loadGenerator,
  styleOptions: STYLE_OPTIONS,
  formatOptions: FORMAT_OPTIONS,
  densitySettings: DENSITY_SETTINGS,
});

const { downloadPng } = createDownloadAction({
  elements,
  getRenderState: state.getRenderState,
  getAuthState: state.getAuthState,
  setUiState: state.setUiState,
  hasValidSession: session.hasValidSession,
  forceCaptchaFlow: authFlow.forceCaptchaFlow,
  refreshControlStates: ui.refreshControlStates,
  getEncryptedEnvelope,
  injectSuntrazChunk,
});

const handleGenerateWithHelpMessage = ui.createGenerateHandler(generate);

async function init() {
  populateSelect(elements.styleSelect, STYLE_OPTIONS);
  populateSelect(elements.formatSelect, FORMAT_OPTIONS);

  elements.generateBtn.addEventListener("click", handleGenerateWithHelpMessage);
  elements.downloadBtn.addEventListener("click", () => {
    void downloadPng();
  });
  elements.styleSelect.addEventListener("change", handleGenerateWithHelpMessage);
  elements.formatSelect.addEventListener("change", handleGenerateWithHelpMessage);

  session.loadStoredSession();
  ui.refreshControlStates();
  void authFlow.ensureTurnstileRendered();

  if (session.hasValidSession()) {
    void generate();
  } else {
    elements.meta.textContent = "Complete the human check to start your 1-hour session.";
  }
}

void init();
