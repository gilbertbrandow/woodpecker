const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? response.statusText
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export type AuthUser = {
  id: number
  username: string
}

export const api = {
  auth: {
    me: (): Promise<AuthUser> => request('/auth/me'),
    logout: (): Promise<void> => request('/auth/logout', { method: 'POST' }),
  },
  health: {
    check: (): Promise<{ status: string }> => request('/health'),
  },
}
