import { createRouter, createRoute, createRootRouteWithContext, redirect } from '@tanstack/react-router'
import type { AuthContextValue } from './context/auth'
import { Layout } from './components/Layout'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { WaitlistPage } from './pages/WaitlistPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
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
import { ScrapedPositionalSourcePage } from './pages/ScrapedPositionalSourcePage'
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
    if (context.auth.loading) return
    if (context.auth.user) throw redirect({ to: '/app' })
    if (context.auth.onboarding) throw redirect({ to: '/onboarding' })
    if (context.auth.waitlisted) throw redirect({ to: '/waitlist' })
  },
  component: LoginPage,
})

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  beforeLoad: ({ context }) => {
    if (context.auth.loading) return
    if (context.auth.user) throw redirect({ to: '/app' })
    if (!context.auth.onboarding) throw redirect({ to: '/' })
  },
  component: OnboardingPage,
})

const waitlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/waitlist',
  beforeLoad: ({ context }) => {
    if (context.auth.loading) return
    if (context.auth.user) throw redirect({ to: '/app' })
    if (!context.auth.waitlisted) throw redirect({ to: '/' })
  },
  component: WaitlistPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: ({ context }) => {
    if (context.auth.loading) return
    if (context.auth.onboarding) throw redirect({ to: '/onboarding' })
    if (context.auth.waitlisted) throw redirect({ to: '/waitlist' })
    if (!context.auth.user) throw redirect({ to: '/' })
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
  staticData: { crumb: { group: 'Activity', leaf: 'Dashboard' } },
  component: DashboardPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/settings',
  staticData: { crumb: { group: 'User', leaf: 'Settings' } },
  component: SettingsPage,
})

const profileRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/profile',
  staticData: { crumb: { group: 'User', leaf: 'Profile' } },
  component: ProfilePage,
})

const subsetsListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets',
  staticData: { crumb: { group: 'Setup', leaf: 'Subsets' } },
  component: SubsetsListPage,
})

const subsetNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets/new',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Subsets', to: '/app/subsets' }], leaf: 'New Subset' } },
  component: SubsetNewPage,
})

const subsetRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/subsets/$subsetId',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Subsets', to: '/app/subsets' }], leaf: null } },
  component: SubsetPage,
})

const schedulesListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules',
  staticData: { crumb: { group: 'Setup', leaf: 'Schedules' } },
  component: SchedulesListPage,
})

const scheduleNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules/new',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Schedules', to: '/app/schedules' }], leaf: 'New Schedule' } },
  component: ScheduleNewPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/schedules/$scheduleId',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Schedules', to: '/app/schedules' }], leaf: null } },
  component: SchedulePage,
})

const trainingListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training',
  staticData: { crumb: { group: 'Activity', leaf: 'Training' } },
  component: TrainingListPage,
})

const trainingNewRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training/new',
  staticData: { crumb: { group: 'Activity', parents: [{ label: 'Training', to: '/app/training' }], leaf: 'New Training' } },
  component: TrainingNewPage,
})

const trainingRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/training/$trainingId',
  staticData: { crumb: { group: 'Activity', parents: [{ label: 'Training', to: '/app/training' }], leaf: null } },
  component: TrainingPage,
})

const aboutRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/about',
  staticData: { crumb: { group: 'General', leaf: 'About' } },
  component: AboutPage,
})

const sourcesListRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/sources',
  staticData: { crumb: { group: 'Setup', leaf: 'Sources' } },
  component: SourcesListPage,
})

const lichessTacticsDashboardRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/sources/lichess-tactics',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Sources', to: '/app/sources' }], leaf: 'Lichess Tactics' } },
  component: LichessTacticsSourcePage,
})

const scrapedPositionalRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/sources/scraped-positional-puzzles',
  staticData: { crumb: { group: 'Setup', parents: [{ label: 'Sources', to: '/app/sources' }], leaf: 'Scraped Positional' } },
  component: ScrapedPositionalSourcePage,
})

const runRoute = createRoute({
  getParentRoute: () => appShellRoute,
  path: '/runs/$runId',
  staticData: { crumb: { group: 'Activity', parents: [{ label: 'Training', to: '/app/training' }], leaf: null } },
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
  onboardingRoute,
  waitlistRoute,
  appRoute.addChildren([
    appShellRoute.addChildren([
      dashboardRoute,
      settingsRoute,
      profileRoute,
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
      scrapedPositionalRoute,
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
  interface StaticDataRouteOption {
    crumb?: {
      group: string
      parents?: Array<{ label: string; to: string }>
      leaf: string | null // null = dynamic title from BreadcrumbContext
    }
  }
}
