import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useAuth } from '../context/auth'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'

export function DecoySourcePage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Decoys</h1>
          <TrainingItemTypeBadge source="DECOY" />
        </div>

        <p className="text-sm text-muted-foreground max-w-prose">
          Decoy positions are sampled from master and elite OTB games between moves 20 and 60.
          A position is accepted as a Decoy only when the Lichess engine confirms that at least
          three moves are within 50 centipawns of the best evaluation — meaning no single move
          is clearly superior.
        </p>

        <p className="text-sm text-muted-foreground max-w-prose">
          During a run, Decoys are indistinguishable from tactical positions. You must play any
          one of the engine-approved moves to score correctly. After solving, the overview reveals
          the accepted alternatives.
        </p>

        <p className="text-sm text-muted-foreground max-w-prose">
          Including Decoys in a subset trains your ability to assess whether a forcing continuation
          exists, rather than assuming every position contains one.
        </p>
      </div>
    </PageWrapper>
  )
}
