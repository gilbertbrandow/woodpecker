import * as React from 'react'
import { useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { ConceptIcon } from '../ConceptIcon'

type Props = {
  title: string
  badge?: React.ReactNode
  summary: string
  aboutContent: React.ReactNode
  exploreContent: React.ReactNode
  onExploreTabOpen: () => void
}

export function SourceDetailShell({
  title,
  badge,
  summary,
  aboutContent,
  exploreContent,
  onExploreTabOpen,
}: Props): React.ReactElement {
  const exploreOpenedRef = useRef(false)

  const handleTabChange = (value: string): void => {
    if (value === 'explore' && !exploreOpenedRef.current) {
      exploreOpenedRef.current = true
      onExploreTabOpen()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-base font-semibold"><ConceptIcon concept="Source" />{title}</h1>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      <Tabs defaultValue="about" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="explore">Explore</TabsTrigger>
        </TabsList>
        <TabsContent value="about" className="mt-4">
          {aboutContent}
        </TabsContent>
        <TabsContent value="explore" className="mt-4">
          {exploreContent}
        </TabsContent>
      </Tabs>
    </div>
  )
}
