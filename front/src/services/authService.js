import axios from 'axios';
import { setAccessToken, clearAccessToken, getAccessToken } from '../tokenStore';

// Backend base URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// authApi: used for auth endpoints and refresh; sends cookies with requests
export const authApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

/**
 * login: sends credentials; server sets httpOnly refresh cookie and returns accessToken in body
 * returns accessToken
 */
export async function login(username, password) {
  const resp = await authApi.post('/api/auth/login', { username, password });
  const accessToken = resp.data?.accessToken;
  if (!accessToken) throw new Error('Login did not return access token');
  setAccessToken(accessToken);
  return accessToken;
}

/**
 * logout: calls server logout using current access token (must include Authorization header)
 * server will clear refresh cookie; we clear in-memory access token
 */
export async function logout() {
  try {
    const token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    await authApi.post('/api/auth/logout', null, { headers });
  } finally {
    clearAccessToken();
  }
}

/**
 * silentRefresh: attempt to get a new access token by calling /api/auth/refresh
 * This reads the refresh cookie and sets a new refresh cookie on success.
 * On success we set in-memory access token. Throw on failure.
 */
export async function silentRefresh() {
  const resp = await authApi.post('/api/auth/refresh');
  const accessToken = resp.data?.accessToken;
  if (!accessToken) throw new Error('No access token from refresh');
  setAccessToken(accessToken);
  return accessToken;
}

/**
 * getUserInfo: uses the api instance (which attaches Authorization header) to get user info
 * import api lazily to avoid circular import issues
 */
export async function getUserInfo() {
  const { api } = await import('../api');
  const resp = await api.get('/api/user/info');
  return resp.data;
}

/**
 * sessions: list active refresh sessions (requires Authorization)
 * revokeSession: revoke single refresh session jti
 */
export async function listSessions() {
  const { api } = await import('../api');
  const resp = await api.get('/api/auth/sessions');
  return resp.data?.sessions || [];
}

export async function revokeSession(jti) {
  const { api } = await import('../api');
  const resp = await api.delete(`/api/auth/sessions/${encodeURIComponent(jti)}`);
  return resp.data;
}