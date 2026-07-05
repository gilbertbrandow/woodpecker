import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState } from 'react'
import { useAuth } from '../context/auth'
import { useSetBreadcrumbTitle } from '../hooks/useSetBreadcrumbTitle'
import { SourceDetailShell } from '../components/sources/SourceDetailShell'
import { ScrapedPositionalAbout } from '../components/sources/ScrapedPositionalAbout'
import { ScrapedPositionalExplore } from '../components/sources/ScrapedPositionalExplore'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'

export function ScrapedPositionalSourcePage(): React.ReactElement | null {
  const { user } = useAuth()
  const [exploreOpened, setExploreOpened] = useState(false)
  useSetBreadcrumbTitle('Scraped Positional', undefined, 'Source')

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <SourceDetailShell
        title="Scraped Positional"
        badge={<TrainingItemTypeBadge source="SCRAPED_POSITIONAL" />}
        summary="Positional puzzles curated from Lichess games, each with a single constructive answer."
        aboutContent={<ScrapedPositionalAbout />}
        exploreContent={exploreOpened ? <ScrapedPositionalExplore /> : null}
        onExploreTabOpen={() => setExploreOpened(true)}
      />
    </PageWrapper>
  )
}
