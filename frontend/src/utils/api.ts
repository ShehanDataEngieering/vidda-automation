import { useAuth } from '@clerk/react';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useApi() {
  const { getToken } = useAuth();

  return async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    return fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };
}

/** For multipart/form-data uploads — omit Content-Type so browser sets boundary */
export function useUploadApi() {
  const { getToken } = useAuth();

  return async function uploadFetch(path: string, body: FormData): Promise<Response> {
    const token = await getToken();
    return fetch(`${BASE}${path}`, {
      method: 'POST',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
}
