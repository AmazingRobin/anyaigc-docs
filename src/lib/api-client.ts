import { getToken, clearToken } from './auth';
import { apiUrl } from './api-base';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(apiUrl(path), { ...options, headers });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      clearToken();
      window.location.href = '/admin/login';
    }
    throw new Error('Unauthorized');
  }
  return res;
}
