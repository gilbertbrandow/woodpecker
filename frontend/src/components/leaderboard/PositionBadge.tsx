import * as React from 'react'
import { type Table } from '@tanstack/react-table'
import cupGold from '../../assets/medals/cup-gold.svg'
import cupSilver from '../../assets/medals/cup-silver.svg'
import cupBronze from '../../assets/medals/cup-bronze.svg'

const cupIcons: Record<1 | 2 | 3, string> = {
  1: cupGold,
  2: cupSilver,
  3: cupBronze,
}

export function PositionBadge({ position }: { position: number }): React.ReactElement {
  if (position === 1 || position === 2 || position === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center">
        <img src={cupIcons[position]} alt={`${position}`} className="h-7 w-7" />
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
  const { pageIndex, pageSize } = table.getState().pagination
  const localIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id)
  const visualIndex = pageIndex * pageSize + localIndex

  const primarySort = table.getState().sorting[0]
  if (primarySort) {
    const col = table.getColumn(primarySort.id)
    // rankDesc: true = higher value is better (default); false = lower value is better (e.g. time)
    const rankDesc = (col?.columnDef.meta as { rankDesc?: boolean } | undefined)?.rankDesc ?? true
    const bestFirst = rankDesc === primarySort.desc
    if (!bestFirst) {
      const totalRows = table.getFilteredRowModel().rows.length
      return totalRows - visualIndex
    }
  }

  return visualIndex + 1
}
