import * as React from 'react'
import { useState, useEffect } from 'react'
import { api, type Theme } from '../../lib/api'
import { Input } from '../ui/input'
import { ThemeSlider } from './ThemeSlider'

type ThemeWeightsProps = {
  value: Record<string, number>
  onChange: (v: Record<string, number>) => void
  disabled?: boolean
}


function ThemeRow({
  theme,
  weight,
  onChange,
  disabled,
}: {
  theme: Theme
  weight: number
  onChange: (v: number) => void
  disabled: boolean
}): React.ReactElement {
  return (
    <div className="flex items-center gap-8 rounded-md bg-muted/50 px-3 py-2.5">
      <div className="group relative min-w-0 flex-1 cursor-default">
        <p className="text-sm">{theme.displayName ?? theme.name}</p>
        {theme.description && (
          <div className="pointer-events-none absolute left-0 top-5 z-10 w-64 rounded border bg-background p-2 text-xs text-muted-foreground shadow opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {theme.description}
          </div>
        )}
      </div>
      <div className="flex w-[45%] shrink-0 items-center gap-2">
        <div className="flex-1">
          <ThemeSlider value={weight} onChange={onChange} disabled={disabled} />
        </div>
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {weight.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

export function ThemeWeights({ value, onChange, disabled = false }: ThemeWeightsProps): React.ReactElement {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.themes
      .list()
      .then(setThemes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleWeightChange = (name: string, weight: number): void => {
    const next = { ...value }
    if (Math.abs(weight - 1) < 0.001) {
      delete next[name]
    } else {
      next[name] = weight
    }
    onChange(next)
  }

  const getWeight = (name: string): number => value[name] ?? 1

  const filtered = themes.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      (t.displayName ?? '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Loading themes…</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search themes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
      <div className="flex flex-col gap-1.5">
        {filtered.map((t) => (
          <ThemeRow
            key={t.name}
            theme={t}
            weight={getWeight(t.name)}
            onChange={(v) => handleWeightChange(t.name, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}
