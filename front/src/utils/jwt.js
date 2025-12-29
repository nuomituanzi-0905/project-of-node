export function parseJwt(token) {
  if (!token) return null;
  const p = token.split('.');
  if (p.length !== 3) return null;
  try {
    return JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (e) {
    return null;
  }
}