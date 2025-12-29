import axios from 'axios';
import { setAccessToken, clearAccessToken, getAccessToken } from '../tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const authApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

export async function login(username, password) {
  const resp = await authApi.post('/api/auth/login', { username, password });
  const accessToken = resp.data?.accessToken;
  if (!accessToken) throw new Error('Login did not return access token');
  setAccessToken(accessToken);
  return accessToken;
}

export async function logout() {
  try {
    const token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    await authApi.post('/api/auth/logout', null, { headers });
  } finally {
    clearAccessToken();
  }
}

export async function silentRefresh() {
  const resp = await authApi.post('/api/auth/refresh');
  const accessToken = resp.data?.accessToken;
  if (!accessToken) throw new Error('No access token from refresh');
  setAccessToken(accessToken);
  return accessToken;
}

export async function getUserInfo() {
  const { api } = await import('../api');
  const resp = await api.get('/api/user/info');
  return resp.data;
}

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