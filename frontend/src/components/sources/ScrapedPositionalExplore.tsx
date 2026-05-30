import * as React from 'react'
import { useEffect, useState } from 'react'
import { api, type ScrapedPositionalSourceRunMetadata } from '../../lib/api'
import { ScrapedPositionalDashboard } from './ScrapedPositionalDashboard'
import { ScrapedPositionalItemsSection } from './ScrapedPositionalItemsSection'

export function ScrapedPositionalExplore(): React.ReactElement {
  const [metadata, setMetadata] = useState<ScrapedPositionalSourceRunMetadata | null | undefined>(
    undefined,
  )

  useEffect(() => {
    api.sources.scrapedPositional
      .sourceRunMetadata()
      .then((res) => setMetadata(res.metadata))
      .catch(() => setMetadata(null))
  }, [])

  if (metadata === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (metadata === null) {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-6 text-center">
        <p className="text-sm font-medium">No source metadata available</p>
        <p className="text-sm text-muted-foreground">
          Run a pipeline import to generate metadata before exploring this source.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ScrapedPositionalDashboard metadata={metadata} />
      <ScrapedPositionalItemsSection
        difficulties={metadata.difficultyCounts}
        themes={metadata.themes}
      />
    </div>
  )
}
