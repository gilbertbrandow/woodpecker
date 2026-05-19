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
  status: 'active'
  id: number
  username: string
  displayName: string
  avatarUrl: string | null
  boardTheme: string
  pieceTheme: string
  showTimerTenths: boolean
}

export type OnboardingState = {
  status: 'onboarding'
  lichessUsername: string
  avatarUrl: string | null
}

export type WaitlistedState = {
  status: 'waitlisted'
  email: string | null
}

export type AuthState = AuthUser | OnboardingState | WaitlistedState

export type SettingsPayload = {
  displayName?: string
  avatarUrl?: string
  boardTheme?: string
  pieceTheme?: string
  showTimerTenths?: boolean
}

export type Subset = {
  id: number
  name: string
  status: 'draft' | 'filled' | 'locked'
  puzzleCount: number
  config: SubsetConfig | null
  createdAt: string
  lockedAt: string | null
  ownedBy: { id: number; displayName: string; avatarUrl: string | null }
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

export type LichessTacticTheme = { name: string; displayName: string | null }
export type LichessTacticOpening = { name: string; displayName: string; eco: string }

export type LichessTacticSourceMetadata = {
  sourceType: 'LICHESS_TACTIC'
  displayId: string
  rating: number
  gameUrl: string
  themes: LichessTacticTheme[]
}

export type ScrapedPositionalSourceMetadata = {
  sourceType: 'SCRAPED_POSITIONAL'
}

export type DecoySourceMetadata = {
  sourceType: 'DECOY'
}

export type SourceMetadata = LichessTacticSourceMetadata | ScrapedPositionalSourceMetadata | DecoySourceMetadata

export type LichessTactic = {
  puzzleId: string
  rating: number
  popularity: number
  nbPlays: number
  gameUrl: string
  themes: LichessTacticTheme[]
  openings: LichessTacticOpening[]
}

export type SortColumn = 'rating' | 'popularity' | 'nb_plays'
export type SortOrder = 'asc' | 'desc'

export type LichessTacticPage = {
  puzzles: LichessTactic[]
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

export type TrainingItemSource = 'LICHESS_TACTIC' | 'DECOY' | 'SCRAPED_POSITIONAL'

export type TrainingItem = {
  id: number
  sourceType: TrainingItemSource
  createdAt: string
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
  createdBy: { id: number; displayName: string; avatarUrl: string | null }
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
  createdBy: { displayName: string; avatarUrl: string | null }
  subset: { id: number; name: string; puzzleCount: number }
}

export type Training = {
  id: number
  scheduleId: number
  status: TrainingStatus
  startedAt: string
  completedAt: string | null
  abortedAt: string | null
  ownerId: number
  ownerDisplayName: string
  ownerAvatarUrl: string | null
  runTargets: RunTarget[]
  schedule: TrainingScheduleSummary
}

export type TrainingState =
  | { state: 'not_started'; nextRunIndex: number; totalRuns: number }
  | { state: 'in_progress'; runIndex: number; totalTrainingItems: number; resolvedCount: number; runStartedAt: string; runDeadlineAt: string; isOverdue: boolean; trainingItemsNeededToday: number }
  | { state: 'on_break'; nextRunIndex: number; breakStartedAt: string; breakEndsAt: string; breakRemainingMs: number }
  | { state: 'break_elapsed'; nextRunIndex: number; breakEndedAt: string; elapsedSinceBreakEndMs: number }
  | { state: 'completed' }
  | { state: 'aborted' }

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
  trainingState: TrainingState
}

export type AllTrainingSummary = MyTrainingSummary & {
  user: { id: number; displayName: string; avatarUrl: string | null }
}

export type TrainingPage = {
  items: AllTrainingSummary[]
  total: number
}

export type SelectableUser = {
  id: number
  displayName: string
  avatarUrl: string | null
}

export type ParticipantInfo = {
  id: number
  displayName: string
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
  displayName: string
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

export type RunTrainingItemAttemptEntry = {
  id: number
  tryNumber: number
  status: 'in_progress' | 'solved' | 'failed'
  timeSpentMs: number | null
}

export type RunTrainingItemFull = {
  runTrainingItemId: number
  position: number
  positionStatus: PositionStatus
  source: SourceMetadata
  fen: string
  solution: (string | string[])[]
  maxTriesPerItem: number
  currentTryNumber: number
  currentAttemptId: number | null
  tries: RunTrainingItemAttemptEntry[]
  totalItems: number
  scheduleName: string
  runIndex: number
}

export type PaceChartData = {
  startMs: number
  deadlineMs: number
  totalItems: number
  labelTicks: number[]
  domainStartMs: number
  series: PaceChartTick[]
  status: 'ahead' | 'on_pace' | 'behind'
  itemDelta: number
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
  totalItems: number
  solvedCount: number
  solvedWithRetriesCount: number
  failedCount: number
  inProgressCount: number
  currentRunTrainingItemId: number | null
  paceChart: PaceChartData | null
}

export type RunTrainingItemListItem = {
  runTrainingItemId: number
  position: number
  source: SourceMetadata
  positionStatus: PositionStatus
  tryCount: number
  timeMs: number | null
}

export type RunTrainingItemList = {
  maxTriesPerItem: number
  trainingItems: RunTrainingItemListItem[]
}

export type Schedule = {
  id: number
  name: string
  description: string | null
  subsetId: number
  status: 'draft' | 'locked'
  config: ScheduleConfig | null
  totalHours: number
  createdBy: { id: number; displayName: string; avatarUrl: string | null }
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

export type TrainingItemMetaPgnDisplay = {
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
  runTrainingItemId: number
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
  pgnDisplay: TrainingItemMetaPgnDisplay | null
  impact: {
    runProgressDeltaPct: number | null
    trainingProgressDeltaPct: number | null
    accuracyDeltaPct: number | null
    averageSolveTimeDeltaMs: number | null
  }
}

export type SameTrainingItemRunOverview = {
  runId: number
  runIndex: number
  runTrainingItemId: number
  runTrainingItemStatus: PositionStatus
  attempts: OverviewAttemptView[]
}

export type ProgressRowView = {
  label: string
  value: number
  tooltipLabel: string
  delta: number | null
}

export type RunTrainingItemOverview = {
  runTrainingItem: {
    id: number
    trainingItemId: number
    runId: number
    runIndex: number
    position: number
    status: PositionStatus
    triesRemaining: number
    maxTriesPerItem: number
    qualifyingAttemptId: number | null
    trainingId: number | null
    scheduleName: string | null
  }
  trainingItem: {
    fen: string
    solution: (string | string[])[]
    source: SourceMetadata
  }
  selectedAttemptId: number | null
  attempts: OverviewAttemptView[]
  sameTrainingItemAcrossRuns: SameTrainingItemRunOverview[]
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
    analyze: { enabled: boolean; url: string | null }
    nextTrainingItem: { enabled: boolean; disabledReason: string | null }
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
      totalItems: number
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

export type RunTrainingItemAttemptView = {
  runTrainingItem: {
    id: number
    trainingItemId: number
    runId: number
    runIndex: number
    position: number
    status: PositionStatus
    triesRemaining: number
    currentTryNumber: number
    maxTriesPerItem: number
    trainingId: number | null
    scheduleName: string | null
  }
  trainingItem: {
    fen: string
    solution: (string | string[])[]
    source: SourceMetadata
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
  overview: RunTrainingItemOverview
}

export type GetAttemptResponse =
  | { kind: 'active_attempt'; attemptView: RunTrainingItemAttemptView }
  | { kind: 'completed_attempt'; overviewUrl: string; overview: RunTrainingItemOverview }

export type ContinueRunResult =
  | { runCompleted: true; attemptView: null }
  | { runCompleted: false; attemptView: RunTrainingItemAttemptView }

export type TrainingItemRunReference = {
  runId: number
  runIndex: number
  runTrainingItemId: number
  hasAttempts: boolean
}

export type LichessTacticsThemeDetail = {
  name: string
  displayName: string
  description: string
  count: number
}

export type ScrapedPositionalDifficulty = {
  value: number
  label: string
  minRating: number | null
  maxRating: number | null
}

export type ScrapedPositionalPuzzle = {
  internalId: number
  lichessUrl: string
  difficulty: ScrapedPositionalDifficulty
  themes: { name: string; displayName: string }[]
}

export type ScrapedPositionalPage = {
  puzzles: ScrapedPositionalPuzzle[]
  page: number
  pageSize: number
  totalPages: number
  total: number
}

export type ScrapedPositionalDifficultyDetail = {
  value: number
  label: string
  description: string
  minRating: number | null
  maxRating: number | null
  count: number
}

export type ScrapedPositionalThemeDetail = {
  name: string
  displayName: string
  description: string
  count: number
}

export type ScrapedPositionalSourceRunMetadata = {
  totalPositionalAfterRun: number
  difficultyCounts: ScrapedPositionalDifficultyDetail[]
  themes: ScrapedPositionalThemeDetail[]
  generatedAt: string
}

export type LichessTacticsSourceRunMetadata = {
  latestSourceImportRunId: number
  importedCount: number
  totalTacticsAfterRun: number
  tacticsWithThemesCount: number
  tacticsWithOpeningsCount: number
  minRating: number
  maxRating: number
  averageRating: number | null
  ratingBucketCounts: Record<string, number>
  themes: LichessTacticsThemeDetail[]
  openingCounts: Record<string, number>
  generatedAt: string
}

export const api = {
  auth: {
    me: (): Promise<AuthState> => request('/auth/me'),
    logout: (): Promise<void> => request('/auth/logout', { method: 'POST' }),
    completeOnboarding: (displayName: string): Promise<AuthUser> =>
      request('/auth/onboarding', { method: 'POST', body: JSON.stringify({ displayName }) }),
    updateWaitlistEmail: (email: string): Promise<WaitlistedState> =>
      request('/auth/waitlist/email', { method: 'PATCH', body: JSON.stringify({ email }) }),
  },
  health: {
    check: (): Promise<{ status: string }> => request('/health'),
  },
  settings: {
    update: (payload: SettingsPayload): Promise<AuthUser> =>
      request<AuthUser>('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  subsets: {
    list: (opts?: { lockedOnly?: boolean }): Promise<Subset[]> =>
      request(`/subsets${opts?.lockedOnly ? '?locked=true' : ''}`),
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
    getTrainingItems: (
      id: number,
      page?: number,
      sort?: SortColumn,
      order?: SortOrder,
    ): Promise<LichessTacticPage> => {
      const params = new URLSearchParams()
      if (page !== undefined) params.set('page', String(page))
      if (sort) params.set('sort', sort)
      if (order) params.set('order', order)
      const qs = params.toString()
      return request(`/subsets/${id}/puzzles${qs ? `?${qs}` : ''}`)
    },
    discardTrainingItem: (id: number, puzzleId: string): Promise<void> =>
      request(`/subsets/${id}/puzzles/${puzzleId}`, { method: 'DELETE' }),
    getStats: (id: number): Promise<SubsetStats> => request(`/subsets/${id}/stats`),
  },
  schedules: {
    list: (opts?: { subsetId?: number; lockedOnly?: boolean }): Promise<ScheduleSummary[]> => {
      const params = new URLSearchParams()
      if (opts?.subsetId !== undefined) params.set('subsetId', String(opts.subsetId))
      if (opts?.lockedOnly) params.set('locked', 'true')
      const qs = params.toString()
      return request(`/schedules${qs ? `?${qs}` : ''}`)
    },
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
    listMine: (): Promise<MyTrainingSummary[]> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return request(`/training?tz=${encodeURIComponent(tz)}`)
    },
    listAll: (opts?: {
      scheduleId?: number
      userIds?: number[]
      page?: number
      pageSize?: number
    }): Promise<TrainingPage> => {
      const p = new URLSearchParams()
      if (opts?.scheduleId !== undefined) p.set('scheduleId', String(opts.scheduleId))
      if (opts?.userIds?.length) opts.userIds.forEach((id) => p.append('userId', String(id)))
      if (opts?.page !== undefined) p.set('page', String(opts.page))
      if (opts?.pageSize !== undefined) p.set('pageSize', String(opts.pageSize))
      const qs = p.toString()
      return request(`/training/all${qs ? `?${qs}` : ''}`)
    },
    setRunTarget: (
      trainingId: number,
      runIndex: number,
      target: { targetAccuracy: number | null; targetSolveSeconds: number | null },
    ): Promise<RunTarget> =>
      request(`/training/${trainingId}/run-targets/${runIndex}`, {
        method: 'PUT',
        body: JSON.stringify(target),
      }),
    getCrossRunItem: (trainingId: number, trainingItemId: number): Promise<TrainingItemRunReference[]> =>
      request(`/training/${trainingId}/cross-run-item/${trainingItemId}`),
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
    trainingItems: (runId: number): Promise<RunTrainingItemList> =>
      request(`/runs/${runId}/training-items`),
    getTrainingItem: (runId: number, runTrainingItemId: number): Promise<RunTrainingItemFull> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}`),
    getOverview: (
      runId: number,
      runTrainingItemId: number,
      attemptId?: number,
    ): Promise<{ overview: RunTrainingItemOverview; selectedAttemptId: number | null }> => {
      const qs = attemptId !== undefined ? `?attempt=${attemptId}` : ''
      return request(`/runs/${runId}/training-items/${runTrainingItemId}/overview${qs}`)
    },
    getAttempt: (
      runId: number,
      runTrainingItemId: number,
      attemptId: number,
    ): Promise<GetAttemptResponse> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}/attempts/${attemptId}`),
    startTrainingItem: (runId: number, runTrainingItemId: number): Promise<RunTrainingItemAttemptView> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}/attempts`, { method: 'POST' }),
    continue: (runId: number): Promise<ContinueRunResult> =>
      request(`/runs/${runId}/continue`, { method: 'POST' }),
  },
  leaderboard: {
    list: (scheduleId?: number): Promise<LeaderboardRun[]> =>
      request<{ runs: LeaderboardRun[] }>(
        `/leaderboard${scheduleId !== undefined ? `?scheduleId=${scheduleId}` : ''}`,
      ).then((r) => r.runs),
  },
  sources: {
    lichessTactics: {
      sourceRunMetadata: (): Promise<{ metadata: LichessTacticsSourceRunMetadata | null }> =>
        request('/sources/lichess-tactics/source-run-metadata'),
      items: (params: {
        page?: number
        ratingMin?: number
        ratingMax?: number
        theme?: string
        openings?: string[]
      }): Promise<LichessTacticPage> => {
        const p = new URLSearchParams()
        if (params.page !== undefined) p.set('page', String(params.page))
        if (params.ratingMin !== undefined) p.set('ratingMin', String(params.ratingMin))
        if (params.ratingMax !== undefined) p.set('ratingMax', String(params.ratingMax))
        if (params.theme) p.set('theme', params.theme)
        if (params.openings?.length) p.set('openings', params.openings.join(','))
        const qs = p.toString()
        return request(`/sources/lichess-tactics/items${qs ? `?${qs}` : ''}`)
      },
    },
    scrapedPositional: {
      sourceRunMetadata: (): Promise<{ metadata: ScrapedPositionalSourceRunMetadata | null }> =>
        request('/sources/scraped-positional/source-run-metadata'),
      items: (params: {
        page?: number
        difficulty?: number
        theme?: string
      }): Promise<ScrapedPositionalPage> => {
        const p = new URLSearchParams()
        if (params.page !== undefined) p.set('page', String(params.page))
        if (params.difficulty !== undefined) p.set('difficulty', String(params.difficulty))
        if (params.theme) p.set('theme', params.theme)
        const qs = p.toString()
        return request(`/sources/scraped-positional/items${qs ? `?${qs}` : ''}`)
      },
    },
  },
  users: {
    search: (q: string, limit = 10): Promise<SelectableUser[]> =>
      request(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  },
  attempts: {
    complete: (
      runId: number,
      runTrainingItemId: number,
      attemptId: number,
      uciMoves: string[],
      clientTimeSpentMs: number,
    ): Promise<CompleteAttemptResult> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}/attempts/${attemptId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ uciMoves, clientTimeSpentMs }),
      }),
  },
}
