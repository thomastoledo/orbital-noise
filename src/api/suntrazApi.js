import { BACKEND_BASE_URL } from "../config.js";

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildApiError(response, data) {
  const code = (data && data.error) || `request_failed_${response.status}`;
  const error = new Error(code);
  // @ts-ignore - attach structured information for callers
  error.code = code;
  // @ts-ignore
  error.status = response.status;
  return error;
}

/**
 * Exchange a one-time Turnstile token for a backend session token.
 * @param {string} turnstileToken
 * @returns {Promise<{ sessionToken: string, expiresAt: string | number }>}
 */
export async function getSessionToken(turnstileToken) {
  const response = await fetch(`${BACKEND_BASE_URL}/auth/turnstile`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ turnstileToken }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw buildApiError(response, data);
  }

  return /** @type {{ sessionToken: string, expiresAt: string | number }} */ (data);
}

/**
 * Request encrypted payload envelope for a seed using session auth.
 * @param {number} seed
 * @param {string} sessionToken
 * @returns {Promise<{ alg: string, iter: number, salt_b64: string, iv_b64: string, ct_b64: string }>}
 */
export async function getEncryptedEnvelope(seed, sessionToken) {
  const response = await fetch(`${BACKEND_BASE_URL}/payload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ seed }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw buildApiError(response, data);
  }

  return data;
}
