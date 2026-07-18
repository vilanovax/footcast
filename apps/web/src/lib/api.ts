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

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fn_refresh_token');
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('fn_access_token', accessToken);
  if (refreshToken) localStorage.setItem('fn_refresh_token', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('fn_access_token');
  localStorage.removeItem('fn_refresh_token');
}

type TokenPair = { accessToken: string; refreshToken?: string };

function extractTokens(data: unknown): TokenPair | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  if (typeof root.accessToken === 'string') {
    return {
      accessToken: root.accessToken,
      refreshToken: typeof root.refreshToken === 'string' ? root.refreshToken : undefined,
    };
  }
  const nested = root.tokens;
  if (nested && typeof nested === 'object') {
    const t = nested as Record<string, unknown>;
    if (typeof t.accessToken === 'string') {
      return {
        accessToken: t.accessToken,
        refreshToken: typeof t.refreshToken === 'string' ? t.refreshToken : undefined,
      };
    }
  }
  return null;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!getRefreshToken()) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const json = (await res.json()) as ApiEnvelope<unknown>;
        const tokens = extractTokens(json.data);
        if (!res.ok || json.success === false || !tokens) {
          clearTokens();
          return false;
        }
        setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      } catch {
        // Network blip — keep tokens so the user is not logged out on API restart
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error('اتصال به API برقرار نشد — سرور را چک کنید');
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`پاسخ نامعتبر از API (${res.status})`);
  }

  if (res.status === 401 && !retried) {
    const ok = await tryRefresh();
    if (ok) return apiFetch<T>(path, init, true);
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json;
}

export async function logoutRemote(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      /* ignore */
    }
  }
  clearTokens();
}

export { API_BASE };
