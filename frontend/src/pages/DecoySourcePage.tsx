import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState } from 'react'
import { useAuth } from '../context/auth'
import { useSetBreadcrumbTitle } from '../hooks/useSetBreadcrumbTitle'
import { SourceDetailShell } from '../components/sources/SourceDetailShell'
import { DecoyAbout } from '../components/sources/DecoyAbout'
import { DecoyExplore } from '../components/sources/DecoyExplore'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'

export function DecoySourcePage(): React.ReactElement | null {
  const { user } = useAuth()
  const [exploreOpened, setExploreOpened] = useState(false)
  useSetBreadcrumbTitle('Decoys', undefined, 'Source')

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <SourceDetailShell
        title="Decoys"
        badge={<TrainingItemTypeBadge source="DECOY" />}
        summary="Positions from master games where multiple moves are nearly equal — no single clearly superior option exists."
        aboutContent={<DecoyAbout />}
        exploreContent={exploreOpened ? <DecoyExplore /> : null}
        onExploreTabOpen={() => setExploreOpened(true)}
      />
    </PageWrapper>
  )
}
