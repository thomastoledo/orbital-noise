import { createSeed, DENSITY_SETTINGS, FORMAT_OPTIONS, STYLE_OPTIONS } from "./config.js";
import { loadGenerator } from "./generatorRegistry.js";

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

/** @type {{ seed: number, styleId: import("./config.js").StyleId, formatId: import("./config.js").FormatId } | null} */
let lastRender = null;

/**
 * Builds option elements from static configuration arrays.
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

/**
 * @param {boolean} value
 */
function setBusy(value) {
  generateBtn.disabled = value;
  styleSelect.disabled = value;
  formatSelect.disabled = value;
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

/**
 * Renders one wallpaper using the currently selected style and format.
 * The heavy drawing work is delegated to the original generator module.
 */
async function generate() {
  setBusy(true);

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

    lastRender = {
      seed: info.seed,
      styleId,
      formatId,
    };

    updateMeta(info, style, format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    meta.textContent = `Generation failed: ${message}`;
  } finally {
    setBusy(false);
  }
}

/**
 * Downloads the currently displayed wallpaper as PNG.
 */
function downloadPng() {
  if (!lastRender) {
    meta.textContent = "Generate a wallpaper before downloading.";
    return;
  }

  const link = document.createElement("a");
  link.download = `cosmos-${lastRender.styleId}-${lastRender.formatId}-${lastRender.seed}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * Initializes controls and triggers an initial render.
 */
function init() {
  populateSelect(styleSelect, STYLE_OPTIONS);
  populateSelect(formatSelect, FORMAT_OPTIONS);

  generateBtn.addEventListener("click", generate);
  downloadBtn.addEventListener("click", downloadPng);
  styleSelect.addEventListener("change", generate);
  formatSelect.addEventListener("change", generate);

  void generate();
}

init();
