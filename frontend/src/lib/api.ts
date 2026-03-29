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
  ownedBy: { username: string; avatarUrl: string | null }
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

export type PuzzleLabel = { name: string; displayName: string }
export type PuzzleOpening = { name: string; displayName: string; eco: string }

export type Puzzle = {
  puzzleId: string
  rating: number
  popularity: number
  nbPlays: number
  gameUrl: string
  themes: PuzzleLabel[]
  openings: PuzzleOpening[]
}

export type SortColumn = 'rating' | 'popularity' | 'nb_plays'
export type SortOrder = 'asc' | 'desc'

export type PuzzlePage = {
  puzzles: Puzzle[]
  page: number
  pageSize: number
  totalPages: number
  total: number
}

export type SubsetStats = {
  ratingBuckets: { min: number; max: number; count: number }[]
  themes: { name: string; displayName: string; description: string; count: number }[]
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

export type ScheduleRunDef = {
  target_hours: number
  break_after_hours: number
}

export type PuzzleOrder = 'random' | 'fixed' | 'rating_asc' | 'rating_desc'

export type ScheduleConfig = {
  runs: ScheduleRunDef[]
  puzzle_order: PuzzleOrder
  failed_repetition: {
    mode: 'none' | 'queue'
    max_repeats?: number
  }
}

export type ScheduleSummary = {
  id: number
  name: string
  description: string | null
  status: 'draft' | 'locked'
  createdBy: { username: string; avatarUrl: string | null }
  subsetId: number
  subsetName: string
  runCount: number
  totalHours: number
  puzzleOrder: PuzzleOrder | null
  createdAt: string
  lockedAt: string | null
}

export type ScheduleInsightPoint = {
  date: string
  puzzlesPerDay: number
}

export type RunTarget = {
  runIndex: number
  targetAccuracy: number | null
  targetSolveSeconds: number | null
}

export type ParticipationStatus = 'draft' | 'in_progress' | 'completed' | 'aborted'

export type ParticipationScheduleSummary = {
  id: number
  name: string
  description: string | null
  status: 'locked'
  totalHours: number
  runCount: number
  runs: { target_hours: number; break_after_hours: number }[]
  puzzleOrder: PuzzleOrder | null
  createdBy: { username: string; avatarUrl: string | null }
  subset: { id: number; name: string; puzzleCount: number }
}

export type ScheduleParticipation = {
  id: number
  scheduleId: number
  status: ParticipationStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
  ownerUsername: string
  runTargets: RunTarget[]
  schedule: ParticipationScheduleSummary
}

export type MyParticipationSummary = {
  id: number
  scheduleId: number
  scheduleName: string
  subsetId: number
  status: ParticipationStatus
  runsCompleted: number
  totalRuns: number
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
}

export type AllParticipationSummary = MyParticipationSummary & {
  user: { username: string; avatarUrl: string | null }
}

export type ParticipantInfo = {
  id: number
  username: string
  avatarUrl: string | null
  startedAt: string
}

export type InsightDatapoint = {
  participationId: number
  username: string
  runIndex: number
  accuracy: number
  totalSolveSeconds: number
}

export type MyScheduleParticipation = {
  id: number
  scheduleId: number
  status: ParticipationStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
}

export type Schedule = {
  id: number
  name: string
  description: string | null
  subsetId: number
  status: 'draft' | 'locked'
  config: ScheduleConfig | null
  totalHours: number
  createdBy: { username: string; avatarUrl: string | null }
  createdAt: string
  lockedAt: string | null
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
    delete: (id: number): Promise<void> => request(`/subsets/${id}`, { method: 'DELETE' }),
    lock: (id: number): Promise<Subset> => request(`/subsets/${id}/lock`, { method: 'POST' }),
    getPuzzles: (
      id: number,
      page?: number,
      sort?: SortColumn,
      order?: SortOrder,
    ): Promise<PuzzlePage> => {
      const params = new URLSearchParams()
      if (page !== undefined) params.set('page', String(page))
      if (sort) params.set('sort', sort)
      if (order) params.set('order', order)
      const qs = params.toString()
      return request(`/subsets/${id}/puzzles${qs ? `?${qs}` : ''}`)
    },
    discardPuzzle: (id: number, puzzleId: string): Promise<void> =>
      request(`/subsets/${id}/puzzles/${puzzleId}`, { method: 'DELETE' }),
    getStats: (id: number): Promise<SubsetStats> => request(`/subsets/${id}/stats`),
  },
  schedules: {
    list: (subsetId?: number): Promise<ScheduleSummary[]> =>
      request(`/schedules${subsetId !== undefined ? `?subsetId=${subsetId}` : ''}`),
    get: (id: number): Promise<Schedule> => request(`/schedules/${id}`),
    create: (name: string, subsetId: number): Promise<Schedule> =>
      request('/schedules', { method: 'POST', body: JSON.stringify({ name, subsetId }) }),
    update: (
      id: number,
      updates: { name?: string; description?: string | null; config?: ScheduleConfig | null },
    ): Promise<Schedule> =>
      request(`/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    lock: (id: number): Promise<Schedule> =>
      request(`/schedules/${id}/lock`, { method: 'POST' }),
    delete: (id: number): Promise<void> => request(`/schedules/${id}`, { method: 'DELETE' }),
    insights: (id: number): Promise<ScheduleInsightPoint[]> =>
      request<{ data: ScheduleInsightPoint[] }>(`/schedules/${id}/insights`).then((r) => r.data),
    getMyParticipation: (scheduleId: number): Promise<MyScheduleParticipation | null> =>
      request<MyScheduleParticipation>(`/schedules/${scheduleId}/participations/me`).catch(
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null
          throw err
        },
      ),
    getParticipants: (id: number): Promise<{ count: number; participants: ParticipantInfo[] }> =>
      request(`/schedules/${id}/participations`),
    getParticipationInsights: (
      id: number,
      runs: number[],
      participants: number[],
    ): Promise<{ datapoints: InsightDatapoint[] }> =>
      request(
        `/schedules/${id}/participation-insights?runs=${runs.join(',')}&participants=${participants.join(',')}`,
      ),
  },
  participations: {
    create: (scheduleId: number): Promise<ScheduleParticipation> =>
      request('/participations', { method: 'POST', body: JSON.stringify({ scheduleId }) }),
    get: (id: number): Promise<ScheduleParticipation> => request(`/participations/${id}`),
    listMine: (): Promise<MyParticipationSummary[]> => request('/participations'),
    listAll: (scheduleId?: number): Promise<AllParticipationSummary[]> =>
      request(`/participations/all${scheduleId !== undefined ? `?scheduleId=${scheduleId}` : ''}`),
    setRunTarget: (
      participationId: number,
      runIndex: number,
      target: { targetAccuracy: number | null; targetSolveSeconds: number | null },
    ): Promise<RunTarget> =>
      request(`/participations/${participationId}/run-targets/${runIndex}`, {
        method: 'PUT',
        body: JSON.stringify(target),
      }),
    abort: (participationId: number): Promise<ScheduleParticipation> =>
      request(`/participations/${participationId}/abort`, { method: 'POST' }),
  },
  themes: {
    list: (): Promise<Theme[]> => request('/themes'),
  },
  openings: {
    search: (q: string): Promise<Opening[]> =>
      request(`/openings?q=${encodeURIComponent(q)}`),
  },
}
