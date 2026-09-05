import * as React from 'react'
import { type Table, type StockFeatures, type RowData } from '@tanstack/react-table'
import cupGold from '../../assets/medals/cup-gold.svg'
import cupSilver from '../../assets/medals/cup-silver.svg'
import cupBronze from '../../assets/medals/cup-bronze.svg'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'

const cupIcons: Record<1 | 2 | 3, string> = {
  1: cupGold,
  2: cupSilver,
  3: cupBronze,
}

export function PositionBadge({ position }: { position: number }): React.ReactElement {
  if (position === 1 || position === 2 || position === 3) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-7 w-7 items-center justify-center cursor-default">
            <img src={cupIcons[position]} alt={`No. ${position}`} className="h-7 w-7" />
          </span>
        </TooltipTrigger>
        <TooltipContent>No. {position}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center tabular-nums text-sm text-muted-foreground">
      {position}
    </span>
  )
}

export function getGlobalPosition<T extends RowData>(row: { id: string }, table: Table<StockFeatures, T>): number {
  const { pageIndex, pageSize } = table.store.state.pagination
  const localIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id)
  const visualIndex = pageIndex * pageSize + localIndex

  const primarySort = table.store.state.sorting[0]
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
