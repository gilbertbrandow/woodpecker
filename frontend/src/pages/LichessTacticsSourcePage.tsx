import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState } from 'react'
import { useAuth } from '../context/auth'
import { SourceDetailShell } from '../components/sources/SourceDetailShell'
import { LichessTacticsAbout } from '../components/sources/LichessTacticsAbout'
import { LichessTacticsExplore } from '../components/sources/LichessTacticsExplore'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'

export function LichessTacticsSourcePage(): React.ReactElement | null {
  const { user } = useAuth()
  const [exploreOpened, setExploreOpened] = useState(false)

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <SourceDetailShell
        breadcrumbParentLabel="Sources"
        breadcrumbParentTo="/app/sources"
        title="Lichess Tactics"
        badge={<TrainingItemTypeBadge sourceType="LICHESS_TACTIC" />}
        summary="Tactical puzzles imported from the Lichess puzzle database."
        aboutContent={<LichessTacticsAbout />}
        exploreContent={exploreOpened ? <LichessTacticsExplore /> : null}
        onExploreTabOpen={() => setExploreOpened(true)}
      />
    </PageWrapper>
  )
}
