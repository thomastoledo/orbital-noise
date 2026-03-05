/**
 * Render Turnstile explicitly and wire callbacks.
 * @param {{
 *  container: HTMLElement,
 *  sitekey: string,
 *  onToken: (token: string) => void,
 *  onExpired: () => void,
 *  onError: () => void,
 * }} options
 * @returns {Promise<string | number>}
 */
export async function renderTurnstile(options) {
  const turnstile = await waitForTurnstile();
  const widgetId = turnstile.render(options.container, {
    sitekey: options.sitekey,
    callback(token) {
      options.onToken(String(token));
    },
    "expired-callback"() {
      options.onExpired();
    },
    "timeout-callback"() {
      options.onExpired();
    },
    "error-callback"() {
      options.onError();
    },
  });

  return widgetId;
}

/**
 * @param {string | number | null} widgetId
 */
export function resetTurnstile(widgetId) {
  if (widgetId === null || !window.turnstile) {
    return;
  }
  window.turnstile.reset(widgetId);
}

function waitForTurnstile() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      if (Date.now() - startedAt > 12000) {
        reject(new Error("turnstile_load_timeout"));
        return;
      }
      setTimeout(poll, 150);
    };
    poll();
  });
}
