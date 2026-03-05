const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const TURNSTILE_SITEKEY = "0x4AAAAAACllYcR8reFAKBjJ";
export const BACKEND_BASE_URL = isLocal
  ? "http://localhost:8080"
  : "https://orbital-noise-backend-1aa0a8498a3c.herokuapp.com";
export const SESSION_TTL_SECONDS = 3600;
export const SESSION_STORAGE_KEY = "orbital_noise_session";
