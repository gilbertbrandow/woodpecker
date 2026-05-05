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

export type TrainingRunInsight = {
  runIndex: number
  avgSolveTimeMs: number | null
}

export type TrainingInsights = {
  runs: TrainingRunInsight[]
}

export type TrainingStatus = 'draft' | 'in_progress' | 'completed' | 'aborted'

export type TrainingScheduleSummary = {
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

export type Training = {
  id: number
  scheduleId: number
  status: TrainingStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
  ownerUsername: string
  ownerAvatarUrl: string | null
  runTargets: RunTarget[]
  schedule: TrainingScheduleSummary
}

export type MyTrainingSummary = {
  id: number
  scheduleId: number
  scheduleName: string
  subsetId: number
  status: TrainingStatus
  totalRuns: number
  completedPuzzles: number
  totalPuzzles: number
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
}

export type AllTrainingSummary = MyTrainingSummary & {
  user: { username: string; avatarUrl: string | null }
}

export type ParticipantInfo = {
  id: number
  username: string
  avatarUrl: string | null
  startedAt: string
}

export type InsightDatapoint = {
  trainingId: number
  username: string
  runIndex: number
  accuracy: number
  totalSolveSeconds: number
}

export type MyScheduleTraining = {
  id: number
  scheduleId: number
  status: TrainingStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
}

export type RunStatus = 'active' | 'completed' | 'aborted'

export type LeaderboardRun = {
  runId: number
  trainingId: number
  runIndex: number
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
  status: RunStatus
  username: string
  nickname: string | null
  avatarUrl: string | null
  scheduleId: number
  scheduleName: string
  firstSolvedCount: number
  resolvedCount: number
  totalPuzzles: number
  accuracyPct: number | null
  avgSolveTimeMs: number | null
}

export type PositionStatus =
  | 'not_started'
  | 'in_progress'
  | 'solved'
  | 'solved_with_retries'
  | 'failed'

type PaceChartTick = { timeMs: number; actual: number | null; projection: number | null; target: number }

export type RunPuzzleAttemptEntry = {
  id: number
  tryNumber: number
  status: 'in_progress' | 'solved' | 'failed'
  timeSpentMs: number | null
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
  tries: RunPuzzleAttemptEntry[]
  totalPuzzles: number
  scheduleName: string
  runIndex: number
  themes: PuzzleLabel[]
}

export type PaceChartData = {
  startMs: number
  deadlineMs: number
  totalPuzzles: number
  labelTicks: number[]
  domainStartMs: number
  series: PaceChartTick[]
  status: 'ahead' | 'on_pace' | 'behind'
  puzzleDelta: number
  timeRemainingMs: number
}

export type ActiveRun = {
  runId: number
  scheduleName: string
  runIndex: number
}

export type Run = {
  id: number
  trainingId: number
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
  paceChart: PaceChartData | null
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

export type DisplayMove = {
  san: string
  uci: string
  fen: string
  from: string
  to: string
  moveNumber: number
  isWhite: boolean
  moveStatus: 'correct' | 'wrong' | 'opponent' | null
}

export type PuzzleMetaPgnDisplay = {
  mainline: DisplayMove[]
  variation: DisplayMove[] | null
}

export type OverviewAttemptBoardView = {
  terminalFen: string | null
  lastMove: [string, string] | null
  result: 'correct' | 'wrong' | null
}

export type OverviewAttemptView = {
  id: number
  runId: number
  runIndex: number
  runPuzzleId: number
  tryNumber: number
  status: 'solved' | 'failed' | 'in_progress'
  startedAt: string
  completedAt: string | null
  timeSpentMs: number | null
  moves: string[]
  attemptType: 'scored' | 'practice'
  isQualifying: boolean
  countsTowardsTraining: boolean
  countsTowardsProgress: boolean
  countsTowardsAccuracy: boolean
  countsTowardsAverageTime: boolean
  board: OverviewAttemptBoardView | null
  pgnDisplay: PuzzleMetaPgnDisplay | null
  impact: {
    runProgressDeltaPct: number | null
    trainingProgressDeltaPct: number | null
    accuracyDeltaPct: number | null
    averageSolveTimeDeltaMs: number | null
  }
}

export type SamePuzzleRunOverview = {
  runId: number
  runIndex: number
  runPuzzleId: number
  runPuzzleStatus: PositionStatus
  attempts: OverviewAttemptView[]
}

export type ProgressRowView = {
  label: string
  value: number
  tooltipLabel: string
  delta: number | null
}

export type RunPuzzleOverview = {
  runPuzzle: {
    id: number
    runId: number
    runIndex: number
    position: number
    status: PositionStatus
    triesRemaining: number
    maxTriesPerPuzzle: number
    qualifyingAttemptId: number | null
    trainingId: number | null
    scheduleName: string | null
  }
  puzzle: {
    puzzleId: string
    fen: string
    solution: string[]
    rating: number
    themes: PuzzleLabel[]
    gameUrl: string
  }
  selectedAttemptId: number | null
  attempts: OverviewAttemptView[]
  samePuzzleAcrossRuns: SamePuzzleRunOverview[]
  runPace: {
    chartData: PaceChartData | null
    isRunActive: boolean
  }
  stats: {
    runIndex: number
    accuracy: {
      valuePct: number | null
      deltaPct: number | null
      solvedCount: number
      resolvedCount: number
    }
    averageSolveTime: {
      valueMs: number | null
      deltaMs: number | null
      timeCount: number
    }
  }
  progress: {
    runProgress: ProgressRowView
    trainingProgress: ProgressRowView | null
  }
  actions: {
    runStatus: RunStatus
    retake: { enabled: boolean }
    analyze: { enabled: boolean; url: string }
    nextPuzzle: { enabled: boolean; disabledReason: string | null }
  }
  timer: {
    targetSolveTenths: number | null
  }
  runCompleteOverlay: {
    completedByAttemptId: number
    runId: number
    runIndex: number
    breakDuration: string | null
    isTrainingComplete: boolean
    summary: {
      totalPuzzles: number
      solvedCount: number
      solvedWithRetriesCount: number
      failedCount: number
      accuracyPct: number | null
      averageSolveTimeMs: number | null
    }
  } | null
}

export type SessionAttemptStripItemView = {
  id: number
  tryNumber: number
  status: 'in_progress' | 'solved' | 'failed'
  attemptType: 'scored' | 'practice'
}

export type RunPuzzleAttemptView = {
  runPuzzle: {
    id: number
    runId: number
    runIndex: number
    position: number
    status: PositionStatus
    triesRemaining: number
    currentTryNumber: number
    maxTriesPerPuzzle: number
    trainingId: number | null
    scheduleName: string | null
  }
  puzzle: {
    puzzleId: string
    fen: string
    solution: string[]
    rating: number
    themes: PuzzleLabel[]
    gameUrl: string
  }
  attempt: {
    id: number
    tryNumber: number
    startedAt: string
    attemptType: 'scored' | 'practice'
    countsTowardsTraining: boolean
    countsTowardsProgress: boolean
    countsTowardsAccuracy: boolean
    countsTowardsAverageTime: boolean
  }
  timer: {
    targetSolveTenths: number | null
  }
  sessionAttempts: SessionAttemptStripItemView[]
}

export type CompleteAttemptResult = {
  completedAttemptId: number
  outcome: 'solved' | 'failed'
  runCompletedByThisAttempt: boolean
  overview: RunPuzzleOverview
}

export type GetAttemptResponse =
  | { kind: 'active_attempt'; attemptView: RunPuzzleAttemptView }
  | { kind: 'completed_attempt'; overviewUrl: string; overview: RunPuzzleOverview }

export type ContinueRunResult =
  | { runCompleted: true; attemptView: null }
  | { runCompleted: false; attemptView: RunPuzzleAttemptView }

export type PuzzleRunReference = {
  runId: number
  runIndex: number
  runPuzzleId: number
  hasAttempts: boolean
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
    getMyTraining: (scheduleId: number): Promise<MyScheduleTraining | null> =>
      request<MyScheduleTraining>(`/schedules/${scheduleId}/training/me`).catch(
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null
          throw err
        },
      ),
    getParticipants: (id: number): Promise<{ count: number; participants: ParticipantInfo[] }> =>
      request(`/schedules/${id}/training/participants`),
    getTrainingInsights: (
      id: number,
      runs: number[],
      participants: number[],
    ): Promise<{ datapoints: InsightDatapoint[] }> =>
      request(
        `/schedules/${id}/training-insights?runs=${runs.join(',')}&participants=${participants.join(',')}`,
      ),
  },
  training: {
    create: (scheduleId: number): Promise<Training> =>
      request('/training', { method: 'POST', body: JSON.stringify({ scheduleId }) }),
    get: (id: number): Promise<Training> => request(`/training/${id}`),
    listMine: (): Promise<MyTrainingSummary[]> => request('/training'),
    listAll: (scheduleId?: number): Promise<AllTrainingSummary[]> =>
      request(`/training/all${scheduleId !== undefined ? `?scheduleId=${scheduleId}` : ''}`),
    setRunTarget: (
      trainingId: number,
      runIndex: number,
      target: { targetAccuracy: number | null; targetSolveSeconds: number | null },
    ): Promise<RunTarget> =>
      request(`/training/${trainingId}/run-targets/${runIndex}`, {
        method: 'PUT',
        body: JSON.stringify(target),
      }),
    getCrossRunPuzzle: (trainingId: number, puzzleId: string): Promise<PuzzleRunReference[]> =>
      request(`/training/${trainingId}/cross-run-puzzle/${encodeURIComponent(puzzleId)}`),
    getInsights: (trainingId: number): Promise<TrainingInsights> =>
      request(`/training/${trainingId}/insights`),
    abort: (trainingId: number): Promise<Training> =>
      request(`/training/${trainingId}/abort`, { method: 'POST' }),
  },
  themes: {
    list: (): Promise<Theme[]> => request('/themes'),
  },
  openings: {
    search: (q: string): Promise<Opening[]> =>
      request(`/openings?q=${encodeURIComponent(q)}`),
  },
  runs: {
    getActive: (): Promise<ActiveRun | null> => request('/runs/active'),
    start: (trainingId: number, runIndex?: number): Promise<Run> =>
      request(`/training/${trainingId}/runs`, {
        method: 'POST',
        body: JSON.stringify(runIndex === undefined ? {} : { runIndex }),
      }),
    list: (trainingId: number): Promise<Run[]> =>
      request(`/training/${trainingId}/runs`),
    get: (runId: number): Promise<Run> => request(`/runs/${runId}`),
    abort: (runId: number): Promise<Run> =>
      request(`/runs/${runId}/abort`, { method: 'POST' }),
    puzzles: (runId: number): Promise<RunPuzzleList> => request(`/runs/${runId}/puzzles`),
    getPuzzle: (runId: number, runPuzzleId: number): Promise<RunPuzzleFull> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}`),
    getOverview: (
      runId: number,
      runPuzzleId: number,
      attemptId?: number,
    ): Promise<{ overview: RunPuzzleOverview; selectedAttemptId: number | null }> => {
      const qs = attemptId !== undefined ? `?attempt=${attemptId}` : ''
      return request(`/runs/${runId}/puzzles/${runPuzzleId}/overview${qs}`)
    },
    getAttempt: (
      runId: number,
      runPuzzleId: number,
      attemptId: number,
    ): Promise<GetAttemptResponse> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}/attempts/${attemptId}`),
    startPuzzle: (runId: number, runPuzzleId: number): Promise<RunPuzzleAttemptView> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}/attempts`, { method: 'POST' }),
    continue: (runId: number): Promise<ContinueRunResult> =>
      request(`/runs/${runId}/continue`, { method: 'POST' }),
  },
  leaderboard: {
    list: (scheduleId?: number): Promise<LeaderboardRun[]> =>
      request<{ runs: LeaderboardRun[] }>(
        `/leaderboard${scheduleId !== undefined ? `?scheduleId=${scheduleId}` : ''}`,
      ).then((r) => r.runs),
  },
  attempts: {
    complete: (
      runId: number,
      runPuzzleId: number,
      attemptId: number,
      uciMoves: string[],
      clientTimeSpentMs: number,
    ): Promise<CompleteAttemptResult> =>
      request(`/runs/${runId}/puzzles/${runPuzzleId}/attempts/${attemptId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ uciMoves, clientTimeSpentMs }),
      }),
  },
}
