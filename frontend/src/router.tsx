import { createRouter, createRoute, createRootRouteWithContext, redirect } from '@tanstack/react-router'
import type { AuthContextValue } from './context/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubsetNewPage } from './pages/SubsetNewPage'
import { SubsetPage } from './pages/SubsetPage'
import { ScheduleNewPage } from './pages/ScheduleNewPage'
import { SchedulePage } from './pages/SchedulePage'
import { ParticipationPage } from './pages/ParticipationPage'
import { ParticipationNewPage } from './pages/ParticipationNewPage'
import { RunPage } from './pages/RunPage'
import { BoardPage } from './pages/BoardPage'

type RouterContext = {
  auth: AuthContextValue
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
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

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
})

const subsetNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/subsets/new',
  component: SubsetNewPage,
})

const subsetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/subsets/$subsetId',
  component: SubsetPage,
})

const scheduleNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/schedules/new',
  component: ScheduleNewPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/schedules/$scheduleId',
  component: SchedulePage,
})

const participationNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/participations/new',
  component: ParticipationNewPage,
})

const participationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/participations/$participationId',
  component: ParticipationPage,
})

const runRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/runs/$runId',
  component: RunPage,
})

const runSolveRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/runs/$runId/solve',
  component: BoardPage,
  validateSearch: (search: Record<string, unknown>): { runPuzzleId?: number } => {
    const val = search.runPuzzleId
    if (val === undefined || val === null) return {}
    const n = Number(val)
    return { runPuzzleId: Number.isFinite(n) ? n : undefined }
  },
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    settingsRoute,
    subsetNewRoute,
    subsetRoute,
    scheduleNewRoute,
    scheduleRoute,
    participationNewRoute,
    participationRoute,
    runRoute,
    runSolveRoute,
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
