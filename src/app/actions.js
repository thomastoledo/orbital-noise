export function createGenerateAction({
  elements,
  setUiState,
  setRenderState,
  hasValidSession,
  refreshControlStates,
  appendLog,
  updateMeta,
  createSeed,
  loadGenerator,
  styleOptions,
  formatOptions,
  densitySettings,
}) {
  async function generate() {
    if (!hasValidSession()) {
      appendLog("Please complete the human check to start a 1-hour session.", {
        level: "warn",
        tag: "auth",
      });
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
      appendLog(
        `Starting generation for ${style.label} in ${format.label}.`,
        { level: "info", tag: "render" },
      );
      appendLog(`Pipeline armed with seed=${seed}. Loading renderer module.`, {
        level: "trace",
        tag: "render",
      });

      const generator = await loadGenerator(styleId);
      appendLog("Renderer module ready. Drawing to canvas.", {
        level: "trace",
        tag: "render",
      });
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
      appendLog(`Generation failed: ${message}`, {
        level: "error",
        tag: "render",
      });
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
  appendLog,
  maybeLogArgHint,
  getEncryptedEnvelope,
  injectSuntrazChunk,
}) {
  async function downloadPng() {
    const render = getRenderState().lastRender;
    if (!render) {
      appendLog("Generate a wallpaper before downloading.", {
        level: "warn",
        tag: "download",
      });
      return;
    }

    if (!hasValidSession()) {
      appendLog("Session expired. Please complete the human check again.", {
        level: "warn",
        tag: "auth",
      });
      forceCaptchaFlow();
      return;
    }

    setUiState((state) => ({
      ...state,
      isDownloading: true,
    }));
    refreshControlStates();
    appendLog(
      `Starting download for seed=${render.seed} (${render.styleId}/${render.formatId}).`,
      { level: "info", tag: "download" },
    );

    try {
      const auth = getAuthState();
      appendLog("Requesting encrypted envelope for PNG metadata.", {
        level: "trace",
        tag: "download",
      });
      const envelope = await getEncryptedEnvelope(render.seed, auth.sessionToken);
      appendLog("Metadata response received. Envelope ready for injection.", {
        level: "trace",
        tag: "download",
      });
      maybeLogArgHint("download");

      const baseBlob = await canvasToPngBlob(elements.canvas);
      const baseBuffer = await baseBlob.arrayBuffer();
      appendLog("Embedding envelope and rendering final PNG.", {
        level: "trace",
        tag: "download",
      });
      const enrichedBuffer = injectSuntrazChunk(baseBuffer, envelope);

      const finalBlob = new Blob([enrichedBuffer], { type: "image/png" });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(finalBlob);

      link.download = `cosmos-${render.styleId}-${render.formatId}-${render.seed}.png`;
      link.href = objectUrl;
      link.click();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      appendLog(`Download complete: ${link.download}`, {
        level: "success",
        tag: "download",
      });
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
        appendLog(
          "Session expired or invalid. Please complete the human check again.",
          { level: "warn", tag: "auth" },
        );
        forceCaptchaFlow();
      } else {
        appendLog("Download failed. Please try again.", {
          level: "error",
          tag: "download",
        });
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
