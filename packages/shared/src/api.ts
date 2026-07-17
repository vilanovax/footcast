export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta: ApiMeta | null;
  error: ApiErrorBody | null;
  requestId: string;
}

export function ok<T>(data: T, requestId: string, meta: ApiMeta | null = null): ApiResponse<T> {
  return { success: true, data, meta, error: null, requestId };
}

export function fail(
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    meta: null,
    error: { code, message, details },
    requestId,
  };
}
