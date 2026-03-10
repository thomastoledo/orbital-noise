import { useState } from "statello";

export function createAppState() {
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
      /** @type {{ seed: number, styleId: import("../../config.js").StyleId, formatId: import("../../config.js").FormatId } | null} */ (
        null
      ),
  });

  const [getHelpMessageState, setHelpMessageState] = useState({
    countBeforeHelpMessage: 0,
  });

  return {
    getAuthState,
    setAuthState,
    getUiState,
    setUiState,
    getRenderState,
    setRenderState,
    getHelpMessageState,
    setHelpMessageState,
  };
}
