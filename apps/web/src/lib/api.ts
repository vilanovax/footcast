const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number } | null;
  error?: { message?: string } | null;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fn_access_token');
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('fn_access_token', accessToken);
  if (refreshToken) localStorage.setItem('fn_refresh_token', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('fn_access_token');
  localStorage.removeItem('fn_refresh_token');
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json;
}

export { API_BASE };
