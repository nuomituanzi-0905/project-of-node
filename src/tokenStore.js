// Pure in-memory token store (no localStorage)
// Simple and safe for browser apps: access token lost on full page reload (use silent refresh)
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}