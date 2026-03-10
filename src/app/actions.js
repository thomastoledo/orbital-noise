export function createGenerateAction({
  elements,
  setUiState,
  setRenderState,
  hasValidSession,
  refreshControlStates,
  updateMeta,
  createSeed,
  loadGenerator,
  styleOptions,
  formatOptions,
  densitySettings,
}) {
  async function generate() {
    if (!hasValidSession()) {
      elements.meta.textContent =
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
      const styleId = /** @type {import("../../config.js").StyleId} */ (
        elements.styleSelect.value
      );
      const formatId = /** @type {import("../../config.js").FormatId} */ (
        elements.formatSelect.value
      );

      const style = styleOptions.find((item) => item.id === styleId);
      const format = formatOptions.find((item) => item.id === formatId);

      if (!style || !format) {
        throw new Error("Invalid style or format selection.");
      }

      const seed = createSeed();
      const generator = await loadGenerator(styleId);
      const info = generator.generateWallpaper(elements.canvas, {
        width: format.width,
        height: format.height,
        seed,
        mode: format.generatorMode,
        densityFactor: densitySettings.densityFactor,
        perceptualDensityFactor: densitySettings.perceptualDensityFactor,
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
      elements.meta.textContent = `Generation failed: ${message}`;
    } finally {
      setUiState((state) => ({
        ...state,
        isGenerating: false,
      }));
      refreshControlStates();
    }
  }

  return { generate };
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

export function createDownloadAction({
  elements,
  getRenderState,
  getAuthState,
  setUiState,
  hasValidSession,
  forceCaptchaFlow,
  refreshControlStates,
  getEncryptedEnvelope,
  injectSuntrazChunk,
}) {
  async function downloadPng() {
    const render = getRenderState().lastRender;
    if (!render) {
      elements.meta.textContent = "Generate a wallpaper before downloading.";
      return;
    }

    if (!hasValidSession()) {
      elements.meta.textContent =
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

      const baseBlob = await canvasToPngBlob(elements.canvas);
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
        elements.meta.textContent =
          "Session expired or invalid. Please complete the human check again.";
        forceCaptchaFlow();
      } else {
        elements.meta.textContent = "Download failed. Please try again.";
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

  return { downloadPng };
}
