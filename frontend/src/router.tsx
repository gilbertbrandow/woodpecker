import { createRouter, createRoute, createRootRouteWithContext, redirect } from '@tanstack/react-router'
import type { AuthContextValue } from './context/auth'
import { Layout } from './components/Layout'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubsetsListPage } from './pages/SubsetsListPage'
import { SubsetNewPage } from './pages/SubsetNewPage'
import { SubsetPage } from './pages/SubsetPage'
import { SchedulesListPage } from './pages/SchedulesListPage'
import { ScheduleNewPage } from './pages/ScheduleNewPage'
import { SchedulePage } from './pages/SchedulePage'
import { TrainingListPage } from './pages/TrainingListPage'
import { TrainingPage } from './pages/TrainingPage'
import { TrainingNewPage } from './pages/TrainingNewPage'
import { AboutPage } from './pages/AboutPage'
import { SourcesListPage } from './pages/SourcesListPage'
import { LichessTacticsSourcePage } from './pages/LichessTacticsSourcePage'
import { RunPage } from './pages/RunPage'
import { RunResolverPage } from './pages/RunResolverPage'
import { TrainingItemResolverPage } from './pages/TrainingItemResolverPage'
import { BoardPage } from './pages/BoardPage'
import { SolveFlowLayout } from './components/SolveFlowLayout'

type RouterContext = {
  auth: AuthContextValue
}

export type RunTrainingItemOverviewSearch = {
  attempt?: number
}

function validateRunPuzzleOverviewSearch(search: Record<string, unknown>): RunTrainingItemOverviewSearch {
  const rawAttempt = search.attempt
  if (rawAttempt === undefined || rawAttempt === null || rawAttempt === '') {
    return {}
  }

  const parsedAttempt = typeof rawAttempt === 'number'
    ? rawAttempt
    : Number.parseInt(String(rawAttempt), 10)

  if (!Number.isInteger(parsedAttempt) || parsedAttempt <= 0) {
    return {}
  }

  return { attempt: parsedAttempt }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && context.auth.user) {
      throw redirect({ to: '/app' })
    }
  },
  component: LoginPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && !context.auth.user) {
      throw redirect({ to: '/' })
    }
  },
})

const appShellRoute = createRoute({
  getParentRoute: () => appRoute,
  id: 'app-shell',
  component: AppShell,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/',
  component: DashboardPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/settings',
  component: SettingsPage,
})

const subsetsListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets',
  component: SubsetsListPage,
})

const subsetNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets/new',
  component: SubsetNewPage,
})

const subsetRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets/$subsetId',
  component: SubsetPage,
})

const schedulesListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules',
  component: SchedulesListPage,
})

const scheduleNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules/new',
  component: ScheduleNewPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules/$scheduleId',
  component: SchedulePage,
})

const trainingListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training',
  component: TrainingListPage,
})

const trainingNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training/new',
  component: TrainingNewPage,
})

const trainingRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training/$trainingId',
  component: TrainingPage,
})

const aboutRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/about',
  component: AboutPage,
})

const sourcesListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/sources',
  component: SourcesListPage,
})

const lichessTacticsDashboardRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/sources/lichess-tactics',
  component: LichessTacticsSourcePage,
})

const runRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/runs/$runId',
  component: RunPage,
})

const solveFlowRoute = createRoute({
  getParentRoute: () => appRoute,
  id: 'solve-flow',
  component: SolveFlowLayout,
})

const runSolveRoute = createRoute({
  getParentRoute: () => solveFlowRoute,
  path: '/runs/$runId/solve',
  component: RunResolverPage,
})

const trainingItemResolverRoute = createRoute({
  getParentRoute: () => solveFlowRoute,
  path: '/runs/$runId/training-items/$runTrainingItemId',
  component: TrainingItemResolverPage,
})

const attemptRoute = createRoute({
  getParentRoute: () => solveFlowRoute,
  path: '/runs/$runId/training-items/$runTrainingItemId/attempts/$attemptId',
  component: BoardPage,
})

const runPuzzleOverviewRoute = createRoute({
  getParentRoute: () => solveFlowRoute,
  path: '/runs/$runId/training-items/$runTrainingItemId/overview',
  validateSearch: validateRunPuzzleOverviewSearch,
  component: BoardPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    appShellRoute.addChildren([
      dashboardRoute,
      settingsRoute,
      subsetsListRoute,
      subsetNewRoute,
      subsetRoute,
      schedulesListRoute,
      scheduleNewRoute,
      scheduleRoute,
      trainingListRoute,
      trainingNewRoute,
      trainingRoute,
      aboutRoute,
      runRoute,
      sourcesListRoute,
      lichessTacticsDashboardRoute,
    ]),
    solveFlowRoute.addChildren([
      runSolveRoute,
      trainingItemResolverRoute,
      attemptRoute,
      runPuzzleOverviewRoute,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
