import * as React from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, type LichessTacticsSourceRunMetadata } from '../../lib/api'
import { LichessTacticsDashboard } from './LichessTacticsDashboard'
import { LichessTacticsItemsSection } from './LichessTacticsItemsSection'

export function LichessTacticsExplore(): React.ReactElement {
  const [metadata, setMetadata] = useState<LichessTacticsSourceRunMetadata | null | undefined>(undefined)

  useEffect(() => {
    api.sources.lichessTactics
      .sourceRunMetadata()
      .then((res) => setMetadata(res.metadata))
      .catch(() => {
        toast.error('Failed to load source data', { description: 'Please try again.' })
        setMetadata(null)
      })
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
      <LichessTacticsDashboard metadata={metadata} />
      <LichessTacticsItemsSection />
    </div>
  )
}
