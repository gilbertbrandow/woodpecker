import * as React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'

export type BreadcrumbParent = { label: string; to: string }

type BreadcrumbContextValue = {
  title: string | null
  concept: string | null
  dynamicParents: BreadcrumbParent[]
  setTitle: (title: string | null, dynamicParents?: BreadcrumbParent[], concept?: string | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  title: null,
  concept: null,
  dynamicParents: [],
  setTitle: () => {},
})

export function BreadcrumbProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [title, setTitleState] = useState<string | null>(null)
  const [concept, setConceptState] = useState<string | null>(null)
  const [dynamicParents, setDynamicParents] = useState<BreadcrumbParent[]>([])

  const setTitle = useCallback((t: string | null, parents?: BreadcrumbParent[], c?: string | null) => {
    setTitleState(t)
    setDynamicParents(parents ?? [])
    setConceptState(c ?? null)
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ title, concept, dynamicParents, setTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbContext(): BreadcrumbContextValue {
  return useContext(BreadcrumbContext)
}
