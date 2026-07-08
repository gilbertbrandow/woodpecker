import type { TrainingItemSource } from './api'

export const SOURCE_NAMES: Record<TrainingItemSource, string> = {
  LICHESS_TACTIC: 'Lichess Tactics',
  SCRAPED_POSITIONAL: 'Scraped Positional',
  DECOY: 'Decoys',
}

export const SOURCE_ROUTES: Record<TrainingItemSource, string> = {
  LICHESS_TACTIC: '/app/sources/lichess-tactics',
  SCRAPED_POSITIONAL: '/app/sources/scraped-positional-puzzles',
  DECOY: '/app/sources/decoys',
}
