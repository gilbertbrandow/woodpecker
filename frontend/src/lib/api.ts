import { request } from './request'
export { ApiError } from './request'

export type AuthUser = {
  status: 'active'
  id: number
  username: string
  displayName: string
  avatarUrl: string | null
  boardTheme: string
  pieceTheme: string
  showTimerTenths: boolean
  isSuperAdmin: boolean
}

export type AdminUser = {
  id: number
  lichessUsername: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
  lastSeenAt: string | null
  isSuperAdmin: boolean
}

export type AdminWaitlistEntry = {
  id: number
  lichessUsername: string
  email: string | null
  createdAt: string
  updatedAt: string
  isWhitelisted: boolean
}

export type AdminWhitelistEntry = {
  id: number
  lichessUsername: string
  createdAt: string
  isRegistered: boolean
}

export type AdminStats = {
  maxUsers: number
  activeUserCount: number
  waitlistCount: number
  whitelistCount: number
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
  hasTrained?: boolean
}

export type LichessTacticSourceConfig = {
  rating?: { min?: number; max?: number; mean?: number; sigma?: number }
  themes?: Record<string, number>
  openings?: { items?: string[]; strength?: number }
}

export type ScrapedPositionalSourceConfig = {
  difficulty?: number[]
  themes?: string[]
  opening?: { items?: string[]; strength?: number }
}

export type DecoySourceConfig = {
  opening?: { items?: string[]; strength?: number }
  acceptedMovesCounts?: number[]
}

export type SourceEntry =
  | { source: 'LICHESS_TACTIC'; percentage: number; config: LichessTacticSourceConfig }
  | { source: 'SCRAPED_POSITIONAL'; percentage: number; config: ScrapedPositionalSourceConfig }
  | { source: 'DECOY'; percentage: number; config: DecoySourceConfig }

export type SubsetRefEntry = {
  subsetId: number
  percentage: number
  excludeSources?: string[]
}

export type SubsetConfig = {
  sources: SourceEntry[]
  subsetRefs?: SubsetRefEntry[]
  excludeSubsets?: number[]
}

export type LichessTacticTheme = { name: string; displayName: string | null }
export type LichessTacticOpening = { name: string; displayName: string; eco: string }
export type TrainingItemOpening = { name: string; displayName: string; eco: string }

export type LichessTacticSourceMetadata = {
  sourceType: 'LICHESS_TACTIC'
  displayId: string
  rating: number
  gameUrl: string
  themes: LichessTacticTheme[]
  opening: TrainingItemOpening | null
}

export type ScrapedPositionalSourceMetadata = {
  sourceType: 'SCRAPED_POSITIONAL'
  internalId: number
  lichessUrl: string
  difficulty: ScrapedPositionalDifficulty
  themes: { name: string; displayName: string }[]
  opening: TrainingItemOpening | null
}

export type DecoyAcceptedMove = {
  uci: string
  cp: number
  dropCp: number
  line: string
}

export type DecoySourceMetadata = {
  sourceType: 'DECOY'
  acceptedMoves: DecoyAcceptedMove[]
  bestCp: number
  depth: number
  analysisUrl: string | null
  moveNumber: number
  game: DecoyGame | null
  opening: TrainingItemOpening | null
}

export type DecoyOpeningCount = {
  displayName: string
  count: number
}

export type DecoySourceRunMetadata = {
  totalDecoysAfterRun: number
  importedCount: number
  topOpenings: DecoyOpeningCount[]
  generatedAt: string
}

export type DecoyGame = {
  white: string
  black: string
  whiteTitle: string | null
  blackTitle: string | null
  whiteElo: number | null
  blackElo: number | null
  event: string | null
  date: string | null
  lichessId: string | null
}

export type DecoyItem = {
  id: number
  fen: string
  opponentMove: string
  acceptedMoves: DecoyAcceptedMove[]
  bestCp: number
  depth: number
  moveNumber: number
  analysisUrl: string | null
  opening: TrainingItemOpening | null
  game: DecoyGame | null
}

export type DecoyPage = {
  puzzles: DecoyItem[]
  page: number
  pageSize: number
  totalPages: number
  total: number
}

export type SourceMetadata = LichessTacticSourceMetadata | ScrapedPositionalSourceMetadata | DecoySourceMetadata

export type LichessTactic = {
  trainingItemId: number
  puzzleId: string
  rating: number
  popularity: number
  nbPlays: number
  gameUrl: string
  themes: LichessTacticTheme[]
  openings: LichessTacticOpening[]
}

export type LichessTacticRow = LichessTactic & { sourceType: 'LICHESS_TACTIC' }

export type ScrapedPositionalRow = {
  trainingItemId: number
  sourceType: 'SCRAPED_POSITIONAL'
  internalId: number
  lichessUrl: string
  difficulty: number
  difficultyLabel: string
  difficultyMinRating: number | null
  difficultyMaxRating: number | null
  themes: { name: string; displayName: string }[]
  opening: TrainingItemOpening | null
}

export type DecoyRow = {
  trainingItemId: number
  sourceType: 'DECOY'
  bestCp: number
  analysisUrl: string | null
  opening: TrainingItemOpening | null
}

export type TrainingItemRow = LichessTacticRow | ScrapedPositionalRow | DecoyRow

export type SortColumn = 'rating' | 'popularity' | 'nb_plays'
export type SortOrder = 'asc' | 'desc'

export type LichessTacticPage = {
  puzzles: LichessTactic[]
  page: number
  pageSize: number
  totalPages: number
  total: number
}

export type TrainingItemPage = {
  puzzles: TrainingItemRow[]
  page: number
  pageSize: number
  totalPages: number
  total: number
}

export type LichessTacticStats = {
  count: number
  ratingBuckets: { min: number; max: number; count: number }[]
  themes: { name: string; displayName: string; description: string; count: number }[]
  openings: { name: string; displayName: string; count: number }[]
  avgPopularity: number
  avgNbPlays: number
  avgRating: number
  noOpeningCount: number
  ratingRange: { min: number | null; max: number | null; step: number }
}

export type ScrapedPositionalStats = {
  count: number
  difficultyDistribution: { value: number; label: string; count: number }[]
  themes: { name: string; displayName: string; count: number }[]
  openings: { name: string; displayName: string; count: number }[]
}

export type DecoyStats = {
  count: number
  openings: { name: string; displayName: string; count: number }[]
}

export type SubsetStats = {
  sources: {
    LICHESS_TACTIC?: LichessTacticStats
    SCRAPED_POSITIONAL?: ScrapedPositionalStats
    DECOY?: DecoyStats
  }
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

export type TrainingProgressPoint = {
  timeMs: number
  actual: number | null
  originalExpected: number | null
  updatedExpected: number | null
}

export type TrainingProgressData = {
  points: TrainingProgressPoint[]
  totalExpectedPuzzles: number
  nowMs: number
}

export type TrainingDetailState =
  | 'not_started'
  | 'active_run_ahead'
  | 'active_run_on_track'
  | 'active_run_behind'
  | 'active_run_overdue'
  | 'scheduled_break'
  | 'overdue_to_start_next_run'
  | 'completed'
  | 'aborted'

export type TrainingDetailStatus = {
  state: TrainingDetailState
  runIndex?: number
  runId?: number
  runStartedAt?: string
  runDeadlineAt?: string
  resolvedCount?: number
  totalItems?: number
  expectedResolvedByNow?: number
  expectedResolvedByTomorrow?: number
  puzzlesToSolveBeforeTomorrow?: number
  nextRunIndex?: number
  breakStartedAt?: string
  breakEndsAt?: string
  breakRemainingMs?: number
  elapsedSinceBreakEndMs?: number
  totalRuns?: number
  originalExpectedResolvedByNow: number
  actualResolved: number
  deltaPuzzlesVsOriginal: number
}

export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'aborted'

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
  | { state: 'active_run_ahead' | 'active_run_on_track' | 'active_run_behind'; runIndex: number; runId: number; runStartedAt: string; runDeadlineAt: string; resolvedCount: number; totalItems: number; expectedResolvedByNow: number; expectedResolvedByTomorrow: number; puzzlesToSolveBeforeTomorrow: number }
  | { state: 'active_run_overdue'; runIndex: number; runId: number; runStartedAt: string; runDeadlineAt: string; resolvedCount: number; totalItems: number }
  | { state: 'scheduled_break'; nextRunIndex: number; breakStartedAt: string; breakEndsAt: string; breakRemainingMs: number }
  | { state: 'overdue_to_start_next_run'; nextRunIndex: number; breakEndsAt: string; elapsedSinceBreakEndMs: number }
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

export type SelectableSchedule = {
  id: number
  name: string
  status: string
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
  avgTimeSolvedMs: number | null
  avgTimeFailedMs: number | null
  deltaAccuracyPct: number | null
}

export type WeeklyLeaderboardRow = {
  userId: number
  displayName: string
  avatarUrl: string | null
  puzzlesSolved: number
  avgRating: number | null
  avgAccuracyPct: number | null
  avgSolveTimeMs: number | null
}

export type PositionStatus =
  | 'not_started'
  | 'in_progress'
  | 'solved'
  | 'solved_with_retries'
  | 'failed'

export type PaceChartTickKind =
  | 'start'
  | 'calendar'
  | 'deadline'
  | 'as_of'
  | 'domain_end'
  | 'projected_finish'
  | 'completed'
  | 'aborted'

export type PaceChartLabelTick = {
  timeMs: number
  kind: PaceChartTickKind
  shortLabel: string
}

export type PaceChartPoint = {
  timeMs: number
  actual: number | null
  required: number
  projection: number | null
  kind?: PaceChartTickKind
}

export type PaceChartSummary = {
  state:
    | 'active_ahead'
    | 'active_on_pace'
    | 'active_behind'
    | 'active_overdue'
    | 'completed'
    | 'aborted'
  resolvedItems: number
  totalItems: number
  remainingItems: number
  deltaItemsVsRequired: number
  deadlineDeltaMs: number
  projectedFinishMs: number | null
  completedAtMs: number | null
  abortedAtMs: number | null
  completedDeltaMs: number | null
  abortedDeltaMs: number | null
}

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
  runStatus: 'active' | 'completed' | 'aborted'
  startMs: number
  deadlineMs: number
  asOfMs: number
  domainStartMs: number
  domainEndMs: number
  totalItems: number
  resolvedItems: number
  requiredResolvedAtAsOf: number
  projectedFinishMs: number | null
  labelTicks: PaceChartLabelTick[]
  series: PaceChartPoint[]
  summary: PaceChartSummary
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
  subvariations: DisplayMove[][] | null
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

export type AttemptHistoryRow = {
  attemptId: number
  runId: number
  runTrainingItemId: number
  userId: number
  displayName: string
  avatarUrl: string | null
  runIndex: number
  tryNumber: number
  countsTowardsTraining: boolean
  result: 'solved' | 'failed'
  timeSpentMs: number | null
  startedAt: string
}

export type AttemptSpectateView = {
  attemptId: number
  timeSpentMs: number | null
  board: OverviewAttemptBoardView | null
  pgnDisplay: TrainingItemMetaPgnDisplay | null
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

export type DashboardStatusCardState =
  | 'training_completed'
  | 'training_aborted'
  | 'run_completed'
  | 'active_run_ahead'
  | 'active_run_on_track'
  | 'active_run_behind'
  | 'active_run_overdue'
  | 'scheduled_break'
  | 'overdue_to_start_next_run'
  | 'not_started'

export type DashboardPrimaryAction =
  | { type: 'continue_run'; runId: number }
  | { type: 'start_run'; trainingId: number; runIndex: number }

export type DashboardStatusCard = {
  state: DashboardStatusCardState
  primaryAction: DashboardPrimaryAction | null
  completedAt?: string
  runIndex?: number
  runId?: number
  runStartedAt?: string
  runDeadlineAt?: string
  resolvedCount?: number
  totalItems?: number
  expectedResolvedByNow?: number
  expectedResolvedByTomorrow?: number
  puzzlesToSolveBeforeTomorrow?: number
  nextRunIndex?: number
  breakEndsAt?: string
  breakRemainingMs?: number
  elapsedSinceBreakEndMs?: number
  totalRuns?: number
}

export type DashboardMetricCards = {
  accuracy: { valuePct: number | null; deltaPct: number | null }
  avgSolveTime: { valueMs: number | null; deltaMs: number | null }
}

export type DashboardTrainingItem = {
  id: number
  scheduleName: string
  status: TrainingStatus
  runCount: number
}

export type DashboardRunSlot = {
  runIndex: number
  selectable: boolean
  runId: number | null
  status: RunStatus | null
}

export type DashboardRunAccuracy = {
  runIndex: number
  accuracyPct: number | null
  inProgress: boolean
  completed: boolean
}

export type DashboardData = {
  selectedTrainingId: number | null
  selectedRunIndex: number | null
  trainings: DashboardTrainingItem[]
  runSlots: DashboardRunSlot[]
  statusCard: DashboardStatusCard | null
  metricCards: DashboardMetricCards | null
  runsAccuracy: DashboardRunAccuracy[]
  progressCard: TrainingProgressData | null
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
  opening: { name: string; displayName: string; eco: string } | null
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
    list: (opts?: {
      lockedOnly?: boolean
      statuses?: string[]
      search?: string
      page?: number
      pageSize?: number
      userIds?: number[]
    }): Promise<{ items: Subset[]; total: number }> => {
      const params = new URLSearchParams()
      if (opts?.lockedOnly) params.set('locked', 'true')
      if (opts?.statuses?.length) params.set('statuses', opts.statuses.join(','))
      if (opts?.search) params.set('search', opts.search)
      if (opts?.page !== undefined) params.set('page', String(opts.page))
      if (opts?.pageSize !== undefined) params.set('pageSize', String(opts.pageSize))
      if (opts?.userIds?.length) params.set('userIds', opts.userIds.join(','))
      const qs = params.toString()
      return request(`/subsets${qs ? `?${qs}` : ''}`)
    },
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
    ): Promise<TrainingItemPage> => {
      const params = new URLSearchParams()
      if (page !== undefined) params.set('page', String(page))
      if (sort) params.set('sort', sort)
      if (order) params.set('order', order)
      const qs = params.toString()
      return request(`/subsets/${id}/puzzles${qs ? `?${qs}` : ''}`)
    },
    discardTrainingItem: (id: number, trainingItemId: number): Promise<void> =>
      request(`/subsets/${id}/puzzles/${trainingItemId}`, { method: 'DELETE' }),
    getStats: (id: number): Promise<SubsetStats> => request(`/subsets/${id}/stats`),
  },
  schedules: {
    list: (opts?: {
      subsetId?: number
      lockedOnly?: boolean
      statuses?: string[]
      search?: string
      page?: number
      pageSize?: number
      userIds?: number[]
    }): Promise<{ items: ScheduleSummary[]; total: number }> => {
      const params = new URLSearchParams()
      if (opts?.subsetId !== undefined) params.set('subsetId', String(opts.subsetId))
      if (opts?.lockedOnly) params.set('locked', 'true')
      if (opts?.statuses?.length) params.set('statuses', opts.statuses.join(','))
      if (opts?.search) params.set('search', opts.search)
      if (opts?.page !== undefined) params.set('page', String(opts.page))
      if (opts?.pageSize !== undefined) params.set('pageSize', String(opts.pageSize))
      if (opts?.userIds?.length) params.set('userIds', opts.userIds.join(','))
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
      request<{ training: MyScheduleTraining | null }>(`/schedules/${scheduleId}/training/me`)
        .then((r) => r.training),
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
      statuses?: string[]
      search?: string
      page?: number
      pageSize?: number
    }): Promise<TrainingPage> => {
      const p = new URLSearchParams()
      p.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone)
      if (opts?.scheduleId !== undefined) p.set('scheduleId', String(opts.scheduleId))
      if (opts?.userIds?.length) opts.userIds.forEach((id) => p.append('userId', String(id)))
      if (opts?.statuses?.length) opts.statuses.forEach((s) => p.append('status', s))
      if (opts?.search) p.set('search', opts.search)
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
    getProgress: (trainingId: number): Promise<TrainingProgressData> =>
      request(`/training/${trainingId}/progress`),
    getDetailStatus: (trainingId: number, tz?: string): Promise<TrainingDetailStatus> =>
      request(`/training/${trainingId}/status${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`),
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
    get: (runId: number): Promise<Run> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return request(`/runs/${runId}?tz=${encodeURIComponent(tz)}`)
    },
    trainingItems: (runId: number): Promise<RunTrainingItemList> =>
      request(`/runs/${runId}/training-items`),
    getTrainingItem: (runId: number, runTrainingItemId: number): Promise<RunTrainingItemFull> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}`),
    getOverview: (
      runId: number,
      runTrainingItemId: number,
      attemptId?: number,
    ): Promise<{ overview: RunTrainingItemOverview; selectedAttemptId: number | null }> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const p = new URLSearchParams({ tz })
      if (attemptId !== undefined) p.set('attempt', String(attemptId))
      return request(`/runs/${runId}/training-items/${runTrainingItemId}/overview?${p.toString()}`)
    },
    getAttempt: (
      runId: number,
      runTrainingItemId: number,
      attemptId: number,
    ): Promise<GetAttemptResponse> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return request(`/runs/${runId}/training-items/${runTrainingItemId}/attempts/${attemptId}?tz=${encodeURIComponent(tz)}`)
    },
    startTrainingItem: (runId: number, runTrainingItemId: number): Promise<RunTrainingItemAttemptView> =>
      request(`/runs/${runId}/training-items/${runTrainingItemId}/attempts`, { method: 'POST' }),
    continue: (runId: number): Promise<ContinueRunResult> =>
      request(`/runs/${runId}/continue`, { method: 'POST' }),
  },
  trainingItems: {
    getAttemptHistory: (
      trainingItemId: number,
      opts?: { page?: number; pageSize?: number; userId?: number[]; result?: string[] },
    ): Promise<{ attempts: AttemptHistoryRow[]; total: number }> => {
      const p = new URLSearchParams()
      if (opts?.page) p.set('page', String(opts.page))
      if (opts?.pageSize) p.set('pageSize', String(opts.pageSize))
      opts?.userId?.forEach((id) => p.append('userId', String(id)))
      opts?.result?.forEach((r) => p.append('result', r))
      const qs = p.toString()
      return request(`/training-items/${trainingItemId}/attempt-history${qs ? `?${qs}` : ''}`)
    },
    getSpectateView: (trainingItemId: number, attemptId: number): Promise<AttemptSpectateView> =>
      request(`/training-items/${trainingItemId}/attempts/${attemptId}`),
  },
  dashboard: {
    get: (opts?: { trainingId?: number; runIndex?: number }): Promise<DashboardData> => {
      const p = new URLSearchParams()
      p.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone)
      if (opts?.trainingId !== undefined) p.set('trainingId', String(opts.trainingId))
      if (opts?.runIndex !== undefined) p.set('runIndex', String(opts.runIndex))
      return request(`/dashboard?${p.toString()}`)
    },
  },
  leaderboard: {
    getRuns: (opts?: { scheduleId?: number; trainingId?: number; runIndex?: number }): Promise<LeaderboardRun[]> => {
      const p = new URLSearchParams()
      if (opts?.trainingId !== undefined && opts?.runIndex !== undefined) {
        p.set('trainingId', String(opts.trainingId))
        p.set('runIndex', String(opts.runIndex))
      } else if (opts?.scheduleId !== undefined) {
        p.set('scheduleId', String(opts.scheduleId))
      }
      const qs = p.toString()
      return request<{ runs: LeaderboardRun[] }>(`/leaderboard${qs ? `?${qs}` : ''}`).then((r) => r.runs)
    },
    getWeekly: (scheduleId?: number): Promise<WeeklyLeaderboardRow[]> =>
      request<{ rows: WeeklyLeaderboardRow[] }>(
        `/leaderboard/weekly${scheduleId !== undefined ? `?scheduleId=${scheduleId}` : ''}`,
      ).then((r) => r.rows),
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
        opening?: string
      }): Promise<ScrapedPositionalPage> => {
        const p = new URLSearchParams()
        if (params.page !== undefined) p.set('page', String(params.page))
        if (params.difficulty !== undefined) p.set('difficulty', String(params.difficulty))
        if (params.theme) p.set('theme', params.theme)
        if (params.opening) p.set('opening', params.opening)
        const qs = p.toString()
        return request(`/sources/scraped-positional/items${qs ? `?${qs}` : ''}`)
      },
    },
    decoys: {
      sourceRunMetadata: (): Promise<{ metadata: DecoySourceRunMetadata | null }> =>
        request('/sources/decoys/source-run-metadata'),
      items: (params: { page?: number; opening?: string }): Promise<DecoyPage> => {
        const p = new URLSearchParams()
        if (params.page !== undefined) p.set('page', String(params.page))
        if (params.opening) p.set('opening', params.opening)
        const qs = p.toString()
        return request(`/sources/decoys/items${qs ? `?${qs}` : ''}`)
      },
    },
  },
  users: {
    search: (q: string, limit = 10): Promise<SelectableUser[]> =>
      request(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    getByIds: (ids: number[]): Promise<SelectableUser[]> =>
      ids.length === 0 ? Promise.resolve([]) : request(`/users/by-ids?ids=${ids.join(',')}`),
  },
  selectableSchedules: {
    getByIds: (ids: number[]): Promise<SelectableSchedule[]> =>
      ids.length === 0 ? Promise.resolve([]) : request(`/schedules/by-ids?ids=${ids.join(',')}`),
  },
  attempts: {
    complete: (
      runId: number,
      runTrainingItemId: number,
      attemptId: number,
      uciMoves: string[],
      clientTimeSpentMs: number,
    ): Promise<CompleteAttemptResult> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return request(
        `/runs/${runId}/training-items/${runTrainingItemId}/attempts/${attemptId}/complete?tz=${encodeURIComponent(tz)}`,
        { method: 'POST', body: JSON.stringify({ uciMoves, clientTimeSpentMs }) },
      )
    },
  },
  admin: {
    users: (params: { page?: number; q?: string }): Promise<{ items: AdminUser[]; total: number }> => {
      const p = new URLSearchParams()
      if (params.page !== undefined) p.set('page', String(params.page))
      if (params.q) p.set('q', params.q)
      const qs = p.toString()
      return request(`/admin/users${qs ? `?${qs}` : ''}`)
    },
    waitlist: (params: { page?: number; q?: string }): Promise<{ items: AdminWaitlistEntry[]; total: number }> => {
      const p = new URLSearchParams()
      if (params.page !== undefined) p.set('page', String(params.page))
      if (params.q) p.set('q', params.q)
      const qs = p.toString()
      return request(`/admin/waitlist${qs ? `?${qs}` : ''}`)
    },
    whitelist: (params: { page?: number; q?: string }): Promise<{ items: AdminWhitelistEntry[]; total: number }> => {
      const p = new URLSearchParams()
      if (params.page !== undefined) p.set('page', String(params.page))
      if (params.q) p.set('q', params.q)
      const qs = p.toString()
      return request(`/admin/whitelist${qs ? `?${qs}` : ''}`)
    },
    addWhitelist: (lichessUsername: string): Promise<AdminWhitelistEntry> =>
      request('/admin/whitelist', { method: 'POST', body: JSON.stringify({ lichessUsername }) }),
    deleteWhitelist: (username: string): Promise<void> =>
      request(`/admin/whitelist/${encodeURIComponent(username)}`, { method: 'DELETE' }),
    deleteWaitlist: (username: string): Promise<void> =>
      request(`/admin/waitlist/${encodeURIComponent(username)}`, { method: 'DELETE' }),
    lichessPlayerSearch: (term: string): Promise<{ result: { id: string; name: string }[] }> =>
      request(`/admin/lichess/player-search?term=${encodeURIComponent(term)}`),
    stats: (): Promise<AdminStats> =>
      request('/admin/stats'),
  },
}
