export function createSessionHelpers({
  getAuthState,
  setAuthState,
  sessionStorageKey,
  sessionTtlSeconds,
}) {
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

    return Date.now() + sessionTtlSeconds * 1000;
  }

  function storeSession(sessionToken, expiresAt) {
    const expiresAtMs = normalizeExpiresAt(expiresAt);
    setAuthState((state) => ({
      ...state,
      sessionToken,
      expiresAtMs,
    }));
    localStorage.setItem(
      sessionStorageKey,
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
    localStorage.removeItem(sessionStorageKey);
  }

  function clearTurnstileToken() {
    setAuthState((state) => ({
      ...state,
      turnstileToken: "",
    }));
  }

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(sessionStorageKey);
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

  return {
    loadStoredSession,
    storeSession,
    clearSession,
    clearTurnstileToken,
    hasValidSession,
  };
}

export function createAuthFlow({
  appendLog,
  turnstileContainer,
  getAuthState,
  setAuthState,
  setUiState,
  storeSession,
  clearSession,
  clearTurnstileToken,
  hasValidSession,
  refreshControlStates,
  turnstileSitekey,
  renderTurnstile,
  resetTurnstile,
  getSessionToken,
}) {
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
    appendLog("Verification received. Exchanging token for session.", {
      level: "info",
      tag: "auth",
    });

    try {
      const session = await getSessionToken(turnstileToken);
      storeSession(session.sessionToken, session.expiresAt);
      setAuthState((state) => ({
        ...state,
        hardError: false,
      }));
      clearTurnstileToken();
      appendLog("Verification complete. Session active for up to 1 hour.", {
        level: "success",
        tag: "auth",
      });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "request_failed";
      if (code === "turnstile_failed") {
        appendLog("Captcha validation failed. Please try again.", {
          level: "warn",
          tag: "auth",
        });
      } else {
        appendLog("Could not create session. Please try again.", {
          level: "error",
          tag: "auth",
        });
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
        sitekey: turnstileSitekey,
        onToken(token) {
          setAuthState((state) => ({
            ...state,
            turnstileToken: token,
          }));
          void exchangeTurnstileForSession(token);
        },
        onExpired() {
          clearTurnstileToken();
          if (!hasValidSession()) {
            appendLog("Human check expired. Please complete it again.", {
              level: "warn",
              tag: "auth",
            });
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
          appendLog("Human check failed to load. Please refresh and retry.", {
            level: "error",
            tag: "auth",
          });
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
      appendLog(
        "Captcha script not loaded (blocked or network error). Disable blockers and refresh.",
        { level: "error", tag: "auth" },
      );
      console.error(error);
    } finally {
      refreshControlStates();
    }
  }

  return {
    ensureTurnstileRendered,
    forceCaptchaFlow,
  };
}
