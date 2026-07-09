import * as React from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useSidebar } from './ui/sidebar'
import { ChevronsUpDown, LayoutDashboard, ScrollText, BookOpenText, Settings, LogOut, Play, User, Trophy, Clock, Users, UserCheck } from 'lucide-react'
import { CONCEPT_ICONS } from '../lib/icons'
import { toast } from '../lib/toast'
import { useAuth } from '../context/auth'
import { parseAvatarValue } from '../lib/avatar'
import { displayName } from '../lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { DefaultAvatar } from './DefaultAvatar'
import { useIsMobile } from '../hooks/use-mobile'
import woodpeckerLogo from '../assets/woodpecker.svg'
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
  // Plain object replaces all search params; function form merges with existing params.
  search?: Record<string, string> | ((prev: Record<string, string | undefined>) => Record<string, string>)
}

const ACTIVITY_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'Leaderboards', to: '/app/leaderboards', icon: Trophy },
  { label: 'Training', to: '/app/training', icon: CONCEPT_ICONS.Training, search: (prev) => ({ ...prev, userId: 'me' }) },
]

const SETUP_ITEMS: NavItem[] = [
  { label: 'Sources', to: '/app/sources', icon: CONCEPT_ICONS.Source },
  { label: 'Subsets', to: '/app/subsets', icon: CONCEPT_ICONS.Subset },
  { label: 'Schedules', to: '/app/schedules', icon: CONCEPT_ICONS.Schedule },
]

const FOOTER_ITEMS: NavItem[] = [
  { label: 'About the method', to: '/app/about', icon: ScrollText },
  { label: 'How does it work?', to: '/app/guide', icon: BookOpenText },
]

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Users', to: '/app/admin/users', icon: Users },
  { label: 'Waitlist', to: '/app/admin/waitlist', icon: Clock },
  { label: 'Whitelist', to: '/app/admin/whitelist', icon: UserCheck },
]

function NavGroup({ items, pathname, onNavigate }: {
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}): React.ReactElement {
  return (
    <SidebarMenu className="gap-1">
      {items.map(({ label, to, icon: Icon, search }) => {
        const isActive = to === '/app' ? pathname === '/app' : pathname.startsWith(to)
        return (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
              <Link to={to} search={search} onClick={onNavigate}>
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

type AppSidebarProps = {
  activeRun: ActiveRun | null
  collapsible?: 'icon' | 'offcanvas' | 'none'
}

export function AppSidebar({ activeRun, collapsible = 'icon' }: AppSidebarProps): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()

  const handleSignOut = async (): Promise<void> => {
    await logout()
    toast.success('Signed out', { description: 'See you next time.' })
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
    <Sidebar collapsible={collapsible}>
      <SidebarHeader className="h-14 justify-center border-b border-transparent py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="Woodpecker"
              className="hover:bg-transparent active:bg-transparent focus-visible:bg-transparent"
            >
              <Link to="/app">
                <div className="flex size-8 shrink-0 items-center justify-center ">
                  <img src={woodpeckerLogo} alt="" className="size-5 dark:invert -mr-1"/>
                </div>
                <span className="font-semibold text-sm text-foreground">Woodpecker</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto group-data-[collapsible=icon]:gap-1">
        <SidebarGroup className="group-data-[collapsible=icon]:py-0">
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
            {ACTIVITY_ITEMS.map(({ label, to, icon: Icon, search }) => {
              const isActive = to === '/app' ? pathname === '/app' : pathname.startsWith(to)
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                    <Link to={to} search={search} onClick={closeMobile}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:py-0">
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <NavGroup items={SETUP_ITEMS} pathname={pathname} onNavigate={closeMobile} />
        </SidebarGroup>

        {user?.isSuperAdmin && (
          <SidebarGroup className="group-data-[collapsible=icon]:py-0">
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <NavGroup items={ADMIN_ITEMS} pathname={pathname} onNavigate={closeMobile} />
          </SidebarGroup>
        )}
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <div className="flex flex-col gap-1 mb-2">
            {FOOTER_ITEMS.map(({ label, to, icon: Icon }) => {
              const isActive = pathname.startsWith(to)
              return (
                <SidebarMenuButton
                  key={to}
                  asChild
                  isActive={isActive}
                  tooltip={label}
                  className="text-foreground/30 hover:text-foreground/60 hover:bg-transparent active:bg-transparent"
                >
                  <Link to={to} onClick={closeMobile}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              )
            })}
          </div>
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
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-semibold">{displayName(user)}</span>
                      <span className="truncate text-[10px] text-muted-foreground">user: {user.username}</span>
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
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="truncate text-sm font-semibold">{displayName(user)}</span>
                        <span className="truncate text-[10px] text-muted-foreground">username: {user.username}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void navigate({ to: '/app/profile' })}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
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
