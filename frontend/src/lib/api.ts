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
  boardTheme: string
  pieceTheme: string
}

export type SettingsPayload = {
  nickname?: string
  avatarUrl?: string
  boardTheme?: string
  pieceTheme?: string
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

export type RunStatus = 'active' | 'completed' | 'aborted'

export type PositionStatus =
  | 'not_started'
  | 'in_progress'
  | 'solved'
  | 'solved_with_retries'
  | 'failed'

export type Run = {
  id: number
  participationId: number
  runIndex: number
  status: RunStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
  totalPuzzles: number
  solvedCount: number
  solvedWithRetriesCount: number
  failedCount: number
  inProgressCount: number
  currentRunPuzzleId: number | null
}

export type RunPuzzleListItem = {
  runPuzzleId: number
  position: number
  puzzleId: string
  rating: number
  positionStatus: PositionStatus
  tryCount: number
  timeMs: number | null
}

export type RunPuzzleList = {
  maxTriesPerPuzzle: number
  puzzles: RunPuzzleListItem[]
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

export type AttemptSummary = {
  id: number
  tryNumber: number
  status: 'in_progress' | 'solved' | 'failed'
  startedAt: string
  completedAt: string | null
  timeSpentMs: number | null
  moves: string[]
}

export type RunPuzzleFull = {
  runPuzzleId: number
  position: number
  positionStatus: PositionStatus
  puzzleId: string
  fen: string
  solution: string
  rating: number
  gameUrl: string
  maxTriesPerPuzzle: number
  currentTryNumber: number
  currentAttemptId: number | null
  tries: AttemptSummary[]
  totalPuzzles: number
  scheduleName: string
  runIndex: number
}

export type CompleteAttemptResult = {
  positionResolved: boolean
  triesRemaining: number
  markedForRetry: boolean
  nextRunPuzzleId: number | null
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
  runs: {
    start: (participationId: number, runIndex?: number): Promise<Run> =>
      request(`/participations/${participationId}/runs`, {
        method: 'POST',
        body: JSON.stringify(runIndex === undefined ? {} : { runIndex }),
      }),
    list: (participationId: number): Promise<Run[]> =>
      request(`/participations/${participationId}/runs`),
    get: (runId: number): Promise<Run> => request(`/runs/${runId}`),
    abort: (runId: number): Promise<Run> =>
      request(`/runs/${runId}/abort`, { method: 'POST' }),
    puzzles: (runId: number): Promise<RunPuzzleList> => request(`/runs/${runId}/puzzles`),
    getPuzzle: (runId: number, runPuzzleId: number): Promise<RunPuzzleFull> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}`),
    startPuzzle: (runId: number, runPuzzleId: number): Promise<RunPuzzleFull> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}/start`, { method: 'POST' }),
    continue: (runId: number): Promise<RunPuzzleFull> =>
      request(`/runs/${runId}/continue`, { method: 'POST' }),
  },
  attempts: {
    complete: (
      attemptId: number,
      status: 'solved' | 'failed',
      moves: string[],
    ): Promise<CompleteAttemptResult> =>
      request(`/attempts/${attemptId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ status, moves }),
      }),
  },
}
