import * as React from 'react'
import { type Table } from '@tanstack/react-table'
import medalGold from '../../assets/medals/medal-gold.svg'
import medalSilver from '../../assets/medals/medal-silver.svg'
import medalBronze from '../../assets/medals/medal-bronze.svg'
import cupGold from '../../assets/medals/cup-gold.svg'
import cupSilver from '../../assets/medals/cup-silver.svg'
import cupBronze from '../../assets/medals/cup-bronze.svg'

const medalIcons: Record<1 | 2 | 3, string> = {
  1: medalGold,
  2: medalSilver,
  3: medalBronze,
}

const cupIcons: Record<1 | 2 | 3, string> = {
  1: cupGold,
  2: cupSilver,
  3: cupBronze,
}

type Props = {
  position: number
  variant?: 'medal' | 'cup'
}

export function PositionBadge({ position, variant }: Props): React.ReactElement {
  if (variant && (position === 1 || position === 2 || position === 3)) {
    const icons = variant === 'medal' ? medalIcons : cupIcons
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center">
        <img src={icons[position]} alt={`${position}`} className="h-7 w-7" />
      </span>
    )
  }

  if (position === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold dark:bg-yellow-900/40 dark:text-yellow-400">
        1
      </span>
    )
  }
  if (position === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold dark:bg-slate-800 dark:text-slate-300">
        2
      </span>
    )
  }
  if (position === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold dark:bg-orange-900/40 dark:text-orange-400">
        3
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center tabular-nums text-sm text-muted-foreground">
      {position}
    </span>
  )
}

export function getGlobalPosition<T>(row: { id: string }, table: Table<T>): number {
  return table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1
}
