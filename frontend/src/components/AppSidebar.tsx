import * as React from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useSidebar } from './ui/sidebar'
import { ChevronsUpDown, LayoutDashboard, Library, CalendarDays, Puzzle, CircleHelp, Settings, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { useAuth } from '../context/auth'
import { parseAvatarValue } from '../lib/avatar'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { DefaultAvatar } from './DefaultAvatar'
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from './ui/sidebar'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'Subsets', to: '/app/subsets', icon: Library },
  { label: 'Schedules', to: '/app/schedules', icon: CalendarDays },
  { label: 'Training', to: '/app/training', icon: Puzzle },
  { label: 'About', to: '/app/about', icon: CircleHelp },
]

export function AppSidebar(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()

  const handleSignOut = async (): Promise<void> => {
    await logout()
    toast('Signed out', { description: 'See you next time.' })
    void navigate({ to: '/' })
  }

  const avatarValue = user ? parseAvatarValue(user.avatarUrl) : null

  const avatarEl = avatarValue ? (
    avatarValue.type === 'custom' ? (
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={avatarValue.url} alt={`${user?.username}'s avatar`} />
        <AvatarFallback className="rounded-lg">
          <DefaultAvatar username={user?.username ?? ''} className="h-8 w-8" />
        </AvatarFallback>
      </Avatar>
    ) : (
      <DefaultAvatar
        username={user?.username ?? ''}
        piece={avatarValue.type === 'default' ? avatarValue.piece : undefined}
        color={avatarValue.type === 'default' ? avatarValue.color : undefined}
        className="h-8 w-8 rounded-lg"
      />
    )
  ) : null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/app" className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center">
            <img src={woodpeckerLogo} alt="Woodpecker logo" className="h-6 w-6 translate-x-0.5 dark:invert" />
          </div>
          <div className="grid flex-1 text-left leading-none group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-semibold text-foreground">Woodpecker</span>
            <span className="truncate text-[10px] text-sidebar-foreground/60 mt-1">Chess trainer</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
            const isActive = to === '/app' ? pathname === '/app' : pathname.startsWith(to)
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                  <Link to={to} onClick={() => setOpenMobile(false)}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
          </SidebarMenu>
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
                    tooltip={user.username}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                      {avatarEl}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">{user.username}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="flex shrink-0 items-center justify-center">{avatarEl}</div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{user.username}</span>
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
