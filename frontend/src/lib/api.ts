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
  nickname: string | null
  avatarUrl: string | null
}

export type SettingsPayload = {
  nickname?: string
  avatarUrl?: string
}

export type Subset = {
  id: number
  name: string
  status: 'draft' | 'filled' | 'locked'
  puzzleCount: number
  config: SubsetConfig | null
  createdAt: string
  lockedAt: string | null
}

export type SubsetConfig = {
  rating?: {
    min?: number
    max?: number
    mean?: number
    sigma?: number
  }
  themes?: Record<string, number>
  openings?: {
    items?: string[]
    strength?: number
  }
}

export type Puzzle = {
  puzzleId: string
  rating: number
  popularity: number
  nbPlays: number
  themes: string[]
  openings: string[]
}

export type PuzzlePage = {
  puzzles: Puzzle[]
  nextPage: number | null
  total: number
}

export type SubsetStats = {
  ratingBuckets: { min: number; max: number; count: number }[]
  themes: { name: string; displayName: string; count: number }[]
  openings: { name: string; displayName: string; count: number }[]
  avgPopularity: number
  avgNbPlays: number
  avgRating: number
  noOpeningCount: number
  totalActive: number
}

export type Theme = {
  name: string
  displayName: string | null
  description: string | null
}

export type Opening = {
  name: string
  displayName: string | null
  eco: string | null
}

export const api = {
  auth: {
    me: (): Promise<AuthUser> => request('/auth/me'),
    logout: (): Promise<void> => request('/auth/logout', { method: 'POST' }),
  },
  health: {
    check: (): Promise<{ status: string }> => request('/health'),
  },
  settings: {
    update: (payload: SettingsPayload): Promise<AuthUser> =>
      request('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  subsets: {
    list: (): Promise<Subset[]> => request('/subsets'),
    get: (id: number): Promise<Subset> => request(`/subsets/${id}`),
    create: (name: string, puzzleCount: number): Promise<Subset> =>
      request('/subsets', { method: 'POST', body: JSON.stringify({ name, puzzleCount }) }),
    saveConfig: (id: number, puzzleCount: number, config: SubsetConfig): Promise<Subset> =>
      request(`/subsets/${id}/config`, {
        method: 'PATCH',
        body: JSON.stringify({ puzzleCount, config }),
      }),
    fill: (id: number): Promise<{ filled: number; requested: number }> =>
      request(`/subsets/${id}/fill`, { method: 'POST' }),
    refill: (id: number): Promise<{ filled: number; needed: number }> =>
      request(`/subsets/${id}/refill`, { method: 'POST' }),
    lock: (id: number): Promise<Subset> => request(`/subsets/${id}/lock`, { method: 'POST' }),
    getPuzzles: (id: number, page?: number): Promise<PuzzlePage> =>
      request(`/subsets/${id}/puzzles${page !== undefined ? `?page=${page}` : ''}`),
    discardPuzzle: (id: number, puzzleId: string): Promise<void> =>
      request(`/subsets/${id}/puzzles/${puzzleId}`, { method: 'DELETE' }),
    getStats: (id: number): Promise<SubsetStats> => request(`/subsets/${id}/stats`),
  },
  themes: {
    list: (): Promise<Theme[]> => request('/themes'),
  },
  openings: {
    search: (q: string): Promise<Opening[]> =>
      request(`/openings?q=${encodeURIComponent(q)}`),
  },
}
