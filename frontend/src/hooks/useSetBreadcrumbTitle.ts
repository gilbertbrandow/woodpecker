import { useEffect, useMemo } from 'react'
import { useBreadcrumbContext, type BreadcrumbParent } from '../context/breadcrumb'

export function useSetBreadcrumbTitle(
  title: string | null | undefined,
  dynamicParents?: BreadcrumbParent[],
  concept?: string | null,
): void {
  const { setTitle } = useBreadcrumbContext()
  const parentsJson = useMemo(
    () => (dynamicParents ? JSON.stringify(dynamicParents) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dynamicParents)],
  )

  useEffect(() => {
    const parents = parentsJson ? (JSON.parse(parentsJson) as BreadcrumbParent[]) : undefined
    setTitle(title ?? null, parents, concept ?? null)
    return () => setTitle(null)
  }, [title, parentsJson, concept, setTitle])
}
