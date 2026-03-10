import { createSeed, DENSITY_SETTINGS, FORMAT_OPTIONS, STYLE_OPTIONS } from "./config.js";
import { loadGenerator } from "./generatorRegistry.js";
import {
  SESSION_STORAGE_KEY,
  SESSION_TTL_SECONDS,
  TURNSTILE_SITEKEY,
} from "./src/config.js";
import { renderTurnstile, resetTurnstile } from "./src/security/turnstile.js";
import { getEncryptedEnvelope, getSessionToken } from "./src/api/suntrazApi.js";
import { injectSuntrazChunk } from "./src/suntraz/pngMetadata.js";
import { useState } from "statello";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("wallpaperCanvas");
/** @type {HTMLSelectElement} */
const styleSelect = document.getElementById("styleSelect");
/** @type {HTMLSelectElement} */
const formatSelect = document.getElementById("formatSelect");
/** @type {HTMLButtonElement} */
const generateBtn = document.getElementById("generateBtn");
/** @type {HTMLButtonElement} */
const downloadBtn = document.getElementById("downloadBtn");
/** @type {HTMLParagraphElement} */
const meta = document.getElementById("meta");
/** @type {HTMLDivElement} */
const turnstileContainer = document.getElementById("turnstileContainer");

/**
 * Adapts Statello's state tuple to the shallow-merge object updates used here.
 *
 * @template {Record<string, unknown>} T
 * @param {T} initialState
 */
function createState(initialState) {
  const [getState, setValue, subscribe] = useState(initialState);

  return {
    getState,
    subscribe,
    /**
     * @param {Partial<T> | ((state: T) => Partial<T>)} nextState
     * @returns {T}
     */
    setState(nextState) {
      setValue((currentState) => {
        const partialState =
          typeof nextState === "function" ? nextState(currentState) : nextState;
        return { ...currentState, ...partialState };
      });
      return getState();
    },
  };
}

const authState = createState({
  sessionToken: "",
  expiresAtMs: 0,
  turnstileToken: "",
  widgetId: null,
  hardError: false,
});

const uiState = createState({
  isGenerating: false,
  isDownloading: false,
  isExchangingSession: false,
});

const renderState = createState({
  lastRender: /** @type {{ seed: number, styleId: import("./config.js").StyleId, formatId: import("./config.js").FormatId } | null} */ (null),
});

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const sessionToken = typeof parsed?.sessionToken === "string" ? parsed.sessionToken : "";
    const expiresAtMs = normalizeExpiresAt(parsed?.expiresAt);

    if (sessionToken && expiresAtMs > Date.now()) {
      authState.setState({
        sessionToken,
        expiresAtMs,
      });
      return;
    }
  } catch (_error) {
    // Ignore storage corruption and start fresh.
  }

  clearSession();
}

function storeSession(sessionToken, expiresAt) {
  const expiresAtMs = normalizeExpiresAt(expiresAt);
  authState.setState({
    sessionToken,
    expiresAtMs,
  });
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      sessionToken,
      expiresAt: new Date(expiresAtMs).toISOString(),
    })
  );
}

function clearSession() {
  authState.setState({
    sessionToken: "",
    expiresAtMs: 0,
  });
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function normalizeExpiresAt(expiresAt) {
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
    return expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
  }

  if (typeof expiresAt === "string") {
    const parsed = Date.parse(expiresAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now() + SESSION_TTL_SECONDS * 1000;
}

function hasValidSession() {
  const state = authState.getState();
  if (!state.sessionToken) {
    return false;
  }

  if (Date.now() >= state.expiresAtMs) {
    clearSession();
    return false;
  }

  return true;
}

/**
 * @template {{ id: string, label: string }} T
 * @param {HTMLSelectElement} select
 * @param {readonly T[]} options
 */
function populateSelect(select, options) {
  select.innerHTML = "";
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    select.appendChild(element);
  }
}

function refreshControlStates() {
  const sessionValid = hasValidSession();
  const auth = authState.getState();
  const ui = uiState.getState();

  generateBtn.disabled = ui.isGenerating || ui.isDownloading || ui.isExchangingSession || !sessionValid || auth.hardError;
  styleSelect.disabled = ui.isGenerating || ui.isDownloading || ui.isExchangingSession;
  formatSelect.disabled = ui.isGenerating || ui.isDownloading || ui.isExchangingSession;

  downloadBtn.disabled =
    ui.isGenerating ||
    ui.isDownloading ||
    ui.isExchangingSession ||
    auth.hardError ||
    !sessionValid ||
    !renderState.getState().lastRender;

  turnstileContainer.style.display = sessionValid ? "none" : "flex";
}

/**
 * @param {import("./config.js").GenerationInfo} info
 * @param {import("./config.js").StyleConfig} style
 * @param {import("./config.js").FormatConfig} format
 */
function updateMeta(info, style, format) {
  const colorsText = (info.colors ?? []).map((color) => color.toUpperCase()).join(", ");
  const detail = colorsText ? ` | colors=${colorsText}` : "";
  meta.textContent = `${style.label} | ${format.label} | seed=${info.seed}${detail}`;
}

function clearTurnstileToken() {
  authState.setState({ turnstileToken: "" });
}

function forceCaptchaFlow() {
  clearTurnstileToken();
  clearSession();
  resetTurnstile(authState.getState().widgetId);
  refreshControlStates();
}

async function exchangeTurnstileForSession(turnstileToken) {
  uiState.setState({ isExchangingSession: true });
  refreshControlStates();

  try {
    const session = await getSessionToken(turnstileToken);
    storeSession(session.sessionToken, session.expiresAt);
    authState.setState({ hardError: false });
    clearTurnstileToken();
    meta.textContent = "Verification complete. Session active for up to 1 hour.";
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "request_failed";
    if (code === "turnstile_failed") {
      meta.textContent = "Captcha validation failed. Please try again.";
    } else {
      meta.textContent = "Could not create session. Please try again.";
    }
    forceCaptchaFlow();
  } finally {
    uiState.setState({ isExchangingSession: false });
    refreshControlStates();
  }
}

async function ensureTurnstileRendered() {
  const auth = authState.getState();
  if (auth.widgetId !== null) {
    return;
  }

  try {
    const widgetId = await renderTurnstile({
      container: turnstileContainer,
      sitekey: TURNSTILE_SITEKEY,
      onToken(token) {
        authState.setState({ turnstileToken: token });
        void exchangeTurnstileForSession(token);
      },
      onExpired() {
        clearTurnstileToken();
        if (!hasValidSession()) {
          meta.textContent = "Human check expired. Please complete it again.";
        }
        resetTurnstile(authState.getState().widgetId);
        refreshControlStates();
      },
      onError() {
        authState.setState({ hardError: true });
        clearTurnstileToken();
        meta.textContent = "Human check failed to load. Please refresh and retry.";
        refreshControlStates();
      },
    });
    authState.setState({ widgetId });
  } catch (error) {
    authState.setState({ hardError: true });
    clearTurnstileToken();
    meta.textContent =
      "Captcha script not loaded (blocked or network error). Disable blockers and refresh.";
    console.error(error);
  } finally {
    refreshControlStates();
  }
}

async function generate() {
  if (!hasValidSession()) {
    meta.textContent = "Please complete the human check to start a 1-hour session.";
    refreshControlStates();
    return;
  }

  uiState.setState({ isGenerating: true });
  refreshControlStates();

  // Show "PLEASE HELP US" message at random time for 300ms
  const randomDelay = Math.random() * 3000;
  const messageTimeout = setTimeout(() => {
    meta.textContent = "PLEASE HELP US";
  }, randomDelay);
  const clearMessageTimeout = setTimeout(() => {
    refreshControlStates();
  }, randomDelay + 300);

  try {
    const styleId = /** @type {import("./config.js").StyleId} */ (styleSelect.value);
    const formatId = /** @type {import("./config.js").FormatId} */ (formatSelect.value);

    const style = STYLE_OPTIONS.find((item) => item.id === styleId);
    const format = FORMAT_OPTIONS.find((item) => item.id === formatId);

    if (!style || !format) {
      throw new Error("Invalid style or format selection.");
    }

    const seed = createSeed();
    const generator = await loadGenerator(styleId);
    const info = generator.generateWallpaper(canvas, {
      width: format.width,
      height: format.height,
      seed,
      mode: format.generatorMode,
      densityFactor: DENSITY_SETTINGS.densityFactor,
      perceptualDensityFactor: DENSITY_SETTINGS.perceptualDensityFactor,
    });

    renderState.setState({
      lastRender: {
        seed: info.seed,
        styleId,
        formatId,
      },
    });

    updateMeta(info, style, format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    meta.textContent = `Generation failed: ${message}`;
  } finally {
    clearTimeout(messageTimeout);
    clearTimeout(clearMessageTimeout);
    uiState.setState({ isGenerating: false });
    refreshControlStates();
  }
}

/**
 * @param {HTMLCanvasElement} sourceCanvas
 * @returns {Promise<Blob>}
 */
function canvasToPngBlob(sourceCanvas) {
  return new Promise((resolve, reject) => {
    sourceCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not export canvas as PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function downloadPng() {
  const render = renderState.getState().lastRender;
  if (!render) {
    meta.textContent = "Generate a wallpaper before downloading.";
    return;
  }

  if (!hasValidSession()) {
    meta.textContent = "Session expired. Please complete the human check again.";
    forceCaptchaFlow();
    return;
  }

  uiState.setState({ isDownloading: true });
  refreshControlStates();

  try {
    const auth = authState.getState();
    const envelope = await getEncryptedEnvelope(render.seed, auth.sessionToken);

    const baseBlob = await canvasToPngBlob(canvas);
    const baseBuffer = await baseBlob.arrayBuffer();
    const enrichedBuffer = injectSuntrazChunk(baseBuffer, envelope);

    const finalBlob = new Blob([enrichedBuffer], { type: "image/png" });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(finalBlob);

    link.download = `cosmos-${render.styleId}-${render.formatId}-${render.seed}.png`;
    link.href = objectUrl;
    link.click();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "request_failed";
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;

    if (status === 401 || code === "expired" || code === "unauthorized") {
      meta.textContent = "Session expired or invalid. Please complete the human check again.";
      forceCaptchaFlow();
    } else {
      meta.textContent = "Download failed. Please try again.";
    }

    console.error(error);
  } finally {
    uiState.setState({ isDownloading: false });
    refreshControlStates();
  }
}

async function init() {
  populateSelect(styleSelect, STYLE_OPTIONS);
  populateSelect(formatSelect, FORMAT_OPTIONS);

  generateBtn.addEventListener("click", generate);
  downloadBtn.addEventListener("click", () => {
    void downloadPng();
  });
  styleSelect.addEventListener("change", generate);
  formatSelect.addEventListener("change", generate);

  loadStoredSession();
  refreshControlStates();
  void ensureTurnstileRendered();

  if (hasValidSession()) {
    void generate();
  } else {
    meta.textContent = "Complete the human check to start your 1-hour session.";
  }
}

void init();
