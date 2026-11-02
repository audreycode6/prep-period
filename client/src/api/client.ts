import type { ApiErrorBody } from '@prep-period/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | undefined;

  constructor(status: number, body: ApiErrorBody | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Turns a failed request into a message for the screen: a 401 as not signed
 * in, otherwise the server's error when it sent one.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return 'Not signed in.';
  if (err instanceof ApiError && err.body) return err.body.error;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/**
 * Sends a request to the API and returns the parsed JSON response, or
 * undefined for a 204. A non-ok response throws an ApiError carrying the
 * status and the server's error body, when the body is JSON.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody: ApiErrorBody | undefined = await res
      .json()
      .catch(() => undefined);
    throw new ApiError(
      res.status,
      errorBody,
      `${method} /api${path} failed: ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiDel(path: string): Promise<void> {
  return request<void>('DELETE', path);
}
