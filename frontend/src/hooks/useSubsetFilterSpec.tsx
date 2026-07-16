import { useMemo } from 'react'
import { SubsetSelector, SubsetSelectorContent } from '../components/SubsetSelector'
import { api, type SelectableSubset } from '../lib/api'
import type { EntityFilterSpec } from '../components/ServerDataTable'
import { LibraryBig } from 'lucide-react'

// Returns a ready-made ServerDataTable EntityFilterSpec for a subset selector filter.
// Pass the urlKey that matches the backend query param (e.g. 'subsetId').
export function useSubsetFilterSpec(urlKey: string, label = 'Subset'): EntityFilterSpec<SelectableSubset> {
  return useMemo<EntityFilterSpec<SelectableSubset>>(() => ({
    type: 'entity',
    key: urlKey,
    label,
    icon: LibraryBig,
    render: (value, onChange) => (
      <SubsetSelector value={value} onChange={onChange} />
    ),
    renderContent: (value, onChange) => (
      <SubsetSelectorContent value={value} onChange={onChange} />
    ),
    serialize: (subsets) => subsets.map((s) => String(s.id)),
    resolveInstant: () => null,
    resolveIds: (ids) => api.subsets.getByIds(ids.map(Number)),
    getChipLabel: (subsets) => {
      if (subsets.length === 0) return ''
      if (subsets.length === 1) return subsets[0].name
      return `${subsets.length} subsets`
    },
    renderChipValue: (subsets) => {
      if (subsets.length === 0) return null
      const label = subsets.length === 1 ? subsets[0].name : `${subsets.length} subsets`
      return <span className="font-medium text-foreground">{label}</span>
    },
  }), [urlKey, label])
}
