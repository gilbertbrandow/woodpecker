import * as React from 'react'
import { Badge } from '../../components/ui/badge'

type DeltaBadgeProps = {
  delta: number | null
  goodWhenPositive: boolean
  format: (n: number) => string
}

export function DeltaBadge({ delta, goodWhenPositive, format }: DeltaBadgeProps): React.ReactElement | null {
  if (delta === null || delta === 0) return null
  const isGood = goodWhenPositive ? delta > 0 : delta < 0
  const arrow = delta > 0 ? '▲' : '▼'
  const sign = delta > 0 ? '+' : '−'
  const cls = isGood
    ? 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    : 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {arrow} {sign}{format(Math.abs(delta))}
    </Badge>
  )
}
