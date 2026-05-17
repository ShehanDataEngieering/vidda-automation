// Mock API module for Jest tests — replaces import.meta.env usage
export function useApi() {
  return async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`http://localhost:3001${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        Authorization: 'Bearer mock-token',
      },
    });
  };
}

export function useUploadApi() {
  return async function uploadFetch(path: string, body: FormData): Promise<Response> {
    return fetch(`http://localhost:3001${path}`, {
      method: 'POST',
      body,
      headers: { Authorization: 'Bearer mock-token' },
    });
  };
}
