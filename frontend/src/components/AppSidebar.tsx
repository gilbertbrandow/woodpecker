import * as React from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useSidebar } from './ui/sidebar'
import { ChevronsUpDown, LayoutDashboard, Library, Database, CalendarDays, Puzzle, CircleHelp, Settings, LogOut, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { parseAvatarValue } from '../lib/avatar'
import { displayName } from '../lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { DefaultAvatar } from './DefaultAvatar'
import { useIsMobile } from '../hooks/use-mobile'
import { AppLogo } from './AppLogo'
import type { ActiveRun } from '../lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from './ui/sidebar'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const ACTIVITY_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'Training', to: '/app/training', icon: Puzzle },
]

const SETUP_ITEMS: NavItem[] = [
  { label: 'Sources', to: '/app/sources', icon: Database },
  { label: 'Subsets', to: '/app/subsets', icon: Library },
  { label: 'Schedules', to: '/app/schedules', icon: CalendarDays },
]

const GENERAL_ITEMS: NavItem[] = [
  { label: 'Help', to: '/app/about', icon: CircleHelp },
]

function NavGroup({ items, pathname, onNavigate }: {
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}): React.ReactElement {
  return (
    <SidebarMenu className="gap-1">
      {items.map(({ label, to, icon: Icon }) => {
        const isActive = to === '/app' ? pathname === '/app' : pathname.startsWith(to)
        return (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
              <Link to={to} onClick={onNavigate}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function AppSidebar({ activeRun }: { activeRun: ActiveRun | null }): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()

  const handleSignOut = async (): Promise<void> => {
    await logout()
    toast('Signed out', { description: 'See you next time.' })
    void navigate({ to: '/' })
  }

  const closeMobile = (): void => setOpenMobile(false)

  const avatarValue = user ? parseAvatarValue(user.avatarUrl) : null

  const avatarEl = avatarValue ? (
    avatarValue.type === 'custom' ? (
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={avatarValue.url} alt={`${user?.displayName}'s avatar`} />
        <AvatarFallback className="rounded-lg">
          <DefaultAvatar username={user?.displayName ?? ''} className="h-8 w-8" />
        </AvatarFallback>
      </Avatar>
    ) : (
      <DefaultAvatar
        username={user?.username ?? ''}
        piece={avatarValue.type === 'default' ? avatarValue.piece : undefined}
        color={avatarValue.type === 'default' ? avatarValue.color : undefined}
        style={avatarValue.type === 'default' ? avatarValue.style : undefined}
        className="h-8 w-8 rounded-lg"
      />
    )
  ) : null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-4 py-0">
        <AppLogo
          iconClassName="h-5 w-5"
          textClassName="text-sm group-data-[collapsible=icon]:hidden"
        />
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel>Activity</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {isMobile && activeRun !== null && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={`Continue — Run ${activeRun.runIndex + 1}`}
                  className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                >
                  <Link
                    to="/app/runs/$runId/solve"
                    params={{ runId: String(activeRun.runId) }}
                    onClick={closeMobile}
                  >
                    <Play className="h-4 w-4" />
                    <span>Continue — Run {activeRun.runIndex + 1}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {ACTIVITY_ITEMS.map(({ label, to, icon: Icon }) => {
              const isActive = to === '/app' ? pathname === '/app' : pathname.startsWith(to)
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                    <Link to={to} onClick={closeMobile}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <NavGroup items={SETUP_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <NavGroup items={GENERAL_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        </SidebarGroup>
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={displayName(user)}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                      {avatarEl}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">{displayName(user)}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="flex shrink-0 items-center justify-center">{avatarEl}</div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{displayName(user)}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void navigate({ to: '/app/settings' })}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleSignOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
