import * as React from 'react'
import type { ScrapedPositionalDifficulty } from '../lib/api'

const DIFFICULTY_STYLES: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  4: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function ratingRange(d: Pick<ScrapedPositionalDifficulty, 'minRating' | 'maxRating'>): string {
  if (d.minRating !== null && d.maxRating !== null) return `${d.minRating}–${d.maxRating}`
  if (d.minRating !== null) return `${d.minRating}+`
  if (d.maxRating !== null) return `≤${d.maxRating}`
  return ''
}

type Props = {
  difficulty: Pick<ScrapedPositionalDifficulty, 'value' | 'label' | 'minRating' | 'maxRating'>
}

export function PositionalDifficultyBadge({ difficulty }: Props): React.ReactElement {
  const style = DIFFICULTY_STYLES[difficulty.value] ?? 'bg-muted text-muted-foreground'
  const range = ratingRange(difficulty)

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {range || difficulty.label}
    </span>
  )
}
