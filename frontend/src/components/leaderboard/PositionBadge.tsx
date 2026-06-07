import * as React from 'react'
import { type Table } from '@tanstack/react-table'

export function PositionBadge({ position }: { position: number }): React.ReactElement {
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
