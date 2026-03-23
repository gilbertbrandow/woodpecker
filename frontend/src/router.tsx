import { createRouter, createRoute, createRootRouteWithContext } from '@tanstack/react-router'
import type { AuthContextValue } from './context/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubsetNewPage } from './pages/SubsetNewPage'
import { SubsetPage } from './pages/SubsetPage'

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

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  settingsRoute,
  subsetNewRoute,
  subsetRoute,
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
