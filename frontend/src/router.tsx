import { createRouter, createRoute, createRootRouteWithContext } from '@tanstack/react-router'
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

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: DashboardPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/settings',
  component: SettingsPage,
})

const subsetNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/subsets/new',
  component: SubsetNewPage,
})

const subsetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/subsets/$subsetId',
  component: SubsetPage,
})

const scheduleNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/schedules/new',
  component: ScheduleNewPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/schedules/$scheduleId',
  component: SchedulePage,
})

const participationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/participations/$participationId',
  component: ParticipationPage,
})

const participationNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/participations/new',
  component: ParticipationNewPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  settingsRoute,
  subsetNewRoute,
  subsetRoute,
  scheduleNewRoute,
  scheduleRoute,
  participationRoute,
  participationNewRoute,
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
