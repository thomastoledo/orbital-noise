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

const [getAuthState, setAuthState] = useState({
  sessionToken: "",
  expiresAtMs: 0,
  turnstileToken: "",
  widgetId: null,
  hardError: false,
});

const [getUiState, setUiState] = useState({
  isGenerating: false,
  isDownloading: false,
  isExchangingSession: false,
});

const [getRenderState, setRenderState] = useState({
  lastRender:
    /** @type {{ seed: number, styleId: import("./config.js").StyleId, formatId: import("./config.js").FormatId } | null} */ (
      null
    ),
});

const [getHelpMessageState, setHelpMessageState] = useState({
  countBeforeHelpMessage: 0,
});

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const sessionToken =
      typeof parsed?.sessionToken === "string" ? parsed.sessionToken : "";
    const expiresAtMs = normalizeExpiresAt(parsed?.expiresAt);

    if (sessionToken && expiresAtMs > Date.now()) {
      setAuthState((state) => ({
        ...state,
        sessionToken,
        expiresAtMs,
      }));
      return;
    }
  } catch (_error) {
    // Ignore storage corruption and start fresh.
  }

  clearSession();
}

function storeSession(sessionToken, expiresAt) {
  const expiresAtMs = normalizeExpiresAt(expiresAt);
  setAuthState((state) => ({
    ...state,
    sessionToken,
    expiresAtMs,
  }));
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      sessionToken,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }),
  );
}

function clearSession() {
  setAuthState((state) => ({
    ...state,
    sessionToken: "",
    expiresAtMs: 0,
  }));
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
  const state = getAuthState();
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
  const auth = getAuthState();
  const ui = getUiState();

  generateBtn.disabled =
    ui.isGenerating ||
    ui.isDownloading ||
    ui.isExchangingSession ||
    !sessionValid ||
    auth.hardError;
  styleSelect.disabled =
    ui.isGenerating || ui.isDownloading || ui.isExchangingSession;
  formatSelect.disabled =
    ui.isGenerating || ui.isDownloading || ui.isExchangingSession;

  downloadBtn.disabled =
    ui.isGenerating ||
    ui.isDownloading ||
    ui.isExchangingSession ||
    auth.hardError ||
    !sessionValid ||
    !getRenderState().lastRender;

  turnstileContainer.style.display = sessionValid ? "none" : "flex";
}

/**
 * @param {import("./config.js").GenerationInfo} info
 * @param {import("./config.js").StyleConfig} style
 * @param {import("./config.js").FormatConfig} format
 */
function updateMeta(info, style, format) {
  const colorsText = (info.colors ?? [])
    .map((color) => color.toUpperCase())
    .join(", ");
  const detail = colorsText ? ` | colors=${colorsText}` : "";
  meta.textContent = `${style.label} | ${format.label} | seed=${info.seed}${detail}`;
}

function clearTurnstileToken() {
  setAuthState((state) => ({
    ...state,
    turnstileToken: "",
  }));
}

function forceCaptchaFlow() {
  clearTurnstileToken();
  clearSession();
  resetTurnstile(getAuthState().widgetId);
  refreshControlStates();
}

async function exchangeTurnstileForSession(turnstileToken) {
  setUiState((state) => ({
    ...state,
    isExchangingSession: true,
  }));
  refreshControlStates();

  try {
    const session = await getSessionToken(turnstileToken);
    storeSession(session.sessionToken, session.expiresAt);
    setAuthState((state) => ({
      ...state,
      hardError: false,
    }));
    clearTurnstileToken();
    meta.textContent =
      "Verification complete. Session active for up to 1 hour.";
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "request_failed";
    if (code === "turnstile_failed") {
      meta.textContent = "Captcha validation failed. Please try again.";
    } else {
      meta.textContent = "Could not create session. Please try again.";
    }
    forceCaptchaFlow();
  } finally {
    setUiState((state) => ({
      ...state,
      isExchangingSession: false,
    }));
    refreshControlStates();
  }
}

async function ensureTurnstileRendered() {
  const auth = getAuthState();
  if (auth.widgetId !== null) {
    return;
  }

  try {
    const widgetId = await renderTurnstile({
      container: turnstileContainer,
      sitekey: TURNSTILE_SITEKEY,
      onToken(token) {
        setAuthState((state) => ({
          ...state,
          turnstileToken: token,
        }));
        exchangeTurnstileForSession(token);
      },
      onExpired() {
        clearTurnstileToken();
        if (!hasValidSession()) {
          meta.textContent = "Human check expired. Please complete it again.";
        }
        resetTurnstile(getAuthState().widgetId);
        refreshControlStates();
      },
      onError() {
        setAuthState((state) => ({
          ...state,
          hardError: true,
        }));
        clearTurnstileToken();
        meta.textContent =
          "Human check failed to load. Please refresh and retry.";
        refreshControlStates();
      },
    });
    setAuthState((state) => ({
      ...state,
      widgetId,
    }));
  } catch (error) {
    setAuthState((state) => ({
      ...state,
      hardError: true,
    }));
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
    meta.textContent =
      "Please complete the human check to start a 1-hour session.";
    refreshControlStates();
    return;
  }

  setUiState((state) => ({
    ...state,
    isGenerating: true,
  }));
  refreshControlStates();

  try {
    const styleId = /** @type {import("./config.js").StyleId} */ (
      styleSelect.value
    );
    const formatId = /** @type {import("./config.js").FormatId} */ (
      formatSelect.value
    );

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

    setRenderState((state) => ({
      ...state,
      lastRender: {
        seed: info.seed,
        styleId,
        formatId,
      },
    }));

    updateMeta(info, style, format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    meta.textContent = `Generation failed: ${message}`;
  } finally {
    setUiState((state) => ({
      ...state,
      isGenerating: false,
    }));
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
  const render = getRenderState().lastRender;
  if (!render) {
    meta.textContent = "Generate a wallpaper before downloading.";
    return;
  }

  if (!hasValidSession()) {
    meta.textContent =
      "Session expired. Please complete the human check again.";
    forceCaptchaFlow();
    return;
  }

  setUiState((state) => ({
    ...state,
    isDownloading: true,
  }));
  refreshControlStates();

  try {
    const auth = getAuthState();
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
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "request_failed";
    const status =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : 0;

    if (status === 401 || code === "expired" || code === "unauthorized") {
      meta.textContent =
        "Session expired or invalid. Please complete the human check again.";
      forceCaptchaFlow();
    } else {
      meta.textContent = "Download failed. Please try again.";
    }

    console.error(error);
  } finally {
    setUiState((state) => ({
      ...state,
      isDownloading: false,
    }));
    refreshControlStates();
  }
}

function displayHelpMessage() {
  const textContent = meta.textContent;
  meta.textContent = "Please help us.";
  setTimeout(() => {
    meta.textContent = textContent;
  }, 300);
}

function updateHelpMessageCountdown() {
  if (getHelpMessageState().countBeforeHelpMessage <= 0) {
    displayHelpMessage();
    setHelpMessageState((state) => ({
      ...state,
      countBeforeHelpMessage: Math.floor(Math.random() * 8) + 2,
    }));
    return;
  }

  setHelpMessageState((state) => ({
    ...state,
    countBeforeHelpMessage: state.countBeforeHelpMessage - 1,
  }));
}

function handleGenerateWithHelpMessage() {
  updateHelpMessageCountdown();
  generate();
}

async function init() {
  populateSelect(styleSelect, STYLE_OPTIONS);
  populateSelect(formatSelect, FORMAT_OPTIONS);

  generateBtn.addEventListener("click", handleGenerateWithHelpMessage);
  downloadBtn.addEventListener("click", () => {
    downloadPng();
  });
  styleSelect.addEventListener("change", handleGenerateWithHelpMessage);
  formatSelect.addEventListener("change", handleGenerateWithHelpMessage);

  loadStoredSession();
  refreshControlStates();
  ensureTurnstileRendered();

  if (hasValidSession()) {
    generate();
  } else {
    meta.textContent = "Complete the human check to start your 1-hour session.";
  }
}

init();
