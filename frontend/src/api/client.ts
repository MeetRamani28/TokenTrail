const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  projectId?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});

  // 1. Authorization header: use Clerk token or dev bypass
  let token = localStorage.getItem('tokentrail_token');
  if (!token && typeof window !== 'undefined' && (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk?.session) {
    try {
      const clerkToken = await (window as unknown as { Clerk: { session: { getToken: () => Promise<string | null> } } }).Clerk.session.getToken();
      if (clerkToken) {
        token = clerkToken;
      }
    } catch {
      // Continue to fallback
    }
  }
  if (!token) {
    token = 'dev_user_admin';
  }

  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 2. Project ID header
  const activeProject = projectId || localStorage.getItem('tokentrail_project_id');
  if (activeProject && !headers.has('X-Project-Id')) {
    headers.set('X-Project-Id', activeProject);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Non-JSON error body
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
