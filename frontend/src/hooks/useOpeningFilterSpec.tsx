import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { type Opening } from '../lib/api'
import { OpeningSelectorContent } from '../components/OpeningSelector'
import type { CustomFilterSpec } from '../components/ServerDataTable'

export function useOpeningFilterSpec(urlKey: string): CustomFilterSpec<Opening> {
  return useMemo<CustomFilterSpec<Opening>>(() => ({
    type: 'custom',
    key: urlKey,
    label: 'Opening',
    icon: BookOpen,
    serialize: (items) => items.map((o) => o.name),
    // Hydrate from URL instantly — name is already in the URL token, so we
    // construct a minimal Opening without an API call. displayName and eco
    // will be null, falling back to the raw name in all display paths.
    resolveInstant: (name) => ({ name, displayName: null, eco: null }),
    render: (value, onChange) => (
      <OpeningSelectorContent value={value} onChange={onChange} />
    ),
    getChipLabel: (items) => {
      if (items.length === 0) return ''
      if (items.length === 1) return items[0].displayName ?? items[0].name
      return `${items.length} openings`
    },
    renderChipValue: (items) => {
      if (items.length === 0) return null
      const label =
        items.length === 1
          ? (items[0].displayName ?? items[0].name)
          : `${items.length} openings`
      return <span className="font-medium text-foreground">{label}</span>
    },
  }), [urlKey])
}
