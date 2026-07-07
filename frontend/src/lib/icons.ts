import {
  Database,
  LibraryBig,
  CalendarDays,
  Swords,
  Flag,
  User,
  Target,
  TrendingUp,
  ChartColumn,
  Clock,
  Calendar,
  CalendarCheck,
  Puzzle,
  ListChecks,
  Activity,
  Zap,
  Compass,
  BarChart2,
  Coffee,
  Repeat,
  Tag,
  LogIn,
  Eye,
  Signature,
  ShieldUser,
  Mail,
  CalendarClock,
  UserKey,
} from 'lucide-react'

export const CONCEPT_ICONS = {
  Source:   Database,
  Subset:   LibraryBig,
  Schedule: CalendarDays,
  Training: Swords,
  Run:      Flag,
} as const

export const DATA_ICONS = {
  // Concept columns
  schedule:   CalendarDays,
  run:        Flag,
  training:   Swords,
  subset:     LibraryBig,
  source:     Database,
  // People
  user:       User,
  // Performance metrics
  accuracy:   Target,
  delta:      TrendingUp,
  rating:     ChartColumn,
  // Time
  time:       Clock,
  started:    Calendar,
  // Counts
  puzzles:    Puzzle,
  attempts:   ListChecks,
  // State
  status:     Activity,
  // Puzzle-type breakdown
  tactical:   Zap,
  positional: Compass,
  // Column-specific
  finished:   CalendarCheck,
  progress:   BarChart2,
  breakTime:  Coffee,
  tries:      Repeat,
  type:       Tag,
  lastLogin:       LogIn,
  lastSeen:        Eye,
  name:            Signature,
  lichessUsername: ShieldUser,
  email:           Mail,
  lastAttempt:     CalendarClock,
  role:            UserKey,
} as const
