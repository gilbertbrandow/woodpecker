import * as React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, Layers, CalendarDays, Dumbbell, Info, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app/', icon: LayoutDashboard },
  { label: 'Subsets', to: '/app/subsets', icon: Layers },
  { label: 'Schedules', to: '/app/schedules', icon: CalendarDays },
  { label: 'Training', to: '/app/training', icon: Dumbbell },
  { label: 'About', to: '/app/about', icon: Info },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }): React.ReactElement {
  const location = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
        const active = to === '/app/' ? location === '/app/' : location.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
