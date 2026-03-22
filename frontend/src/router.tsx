import { createRouter, createRoute, createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { AuthContextValue } from './context/auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

type RouterContext = {
  auth: AuthContextValue
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
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

const routeTree = rootRoute.addChildren([loginRoute, dashboardRoute])

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
