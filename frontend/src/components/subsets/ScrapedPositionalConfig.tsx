import * as React from 'react'
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '../../lib/api'
import type {
  ScrapedPositionalSourceConfig,
  ScrapedPositionalDifficultyDetail,
  ScrapedPositionalThemeDetail,
} from '../../lib/api'
import { OpeningSelector, type OpeningValue } from './OpeningSelector'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible'

type Props = {
  value: ScrapedPositionalSourceConfig
  onChange: (v: ScrapedPositionalSourceConfig) => void
  disabled?: boolean
}

export function ScrapedPositionalConfig({
  value,
  onChange,
  disabled = false,
}: Props): React.ReactElement {
  const [difficulties, setDifficulties] = useState<ScrapedPositionalDifficultyDetail[]>([])
  const [themes, setThemes] = useState<ScrapedPositionalThemeDetail[]>([])
  const [metaLoading, setMetaLoading] = useState(true)
  const [diffOpen, setDiffOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [openingOpen, setOpeningOpen] = useState(false)

  useEffect(() => {
    api.sources.scrapedPositional
      .sourceRunMetadata()
      .then(({ metadata }) => {
        if (metadata) {
          setDifficulties(metadata.difficultyCounts)
          setThemes(metadata.themes)
        }
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false))
  }, [])

  const toggleDifficulty = (val: number): void => {
    const current = value.difficulty ?? []
    const next = current.includes(val) ? current.filter((d) => d !== val) : [...current, val]
    onChange({ ...value, difficulty: next.length > 0 ? next : undefined })
  }

  const toggleTheme = (name: string): void => {
    const current = value.themes ?? []
    const next = current.includes(name) ? current.filter((t) => t !== name) : [...current, name]
    onChange({ ...value, themes: next.length > 0 ? next : undefined })
  }

  const openingValue: OpeningValue = {
    items: value.opening?.items ?? [],
    strength: value.opening?.strength ?? 0,
  }
  const handleOpeningChange = (v: OpeningValue): void => {
    onChange({
      ...value,
      opening: v.items.length > 0 ? { items: v.items, strength: v.strength } : undefined,
    })
  }

  if (metaLoading) {
    return <p className="py-2 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {difficulties.length > 0 && (
        <Collapsible open={diffOpen} onOpenChange={setDiffOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between border-b pb-2 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: diffOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                Difficulty
              </span>
              <span className="text-xs text-muted-foreground">
                {(value.difficulty?.length ?? 0) > 0 ? `${value.difficulty!.length} selected` : 'All'}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-2 pt-3">
              {difficulties.map((d) => {
                const selected = (value.difficulty ?? []).includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDifficulty(d.value)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {d.label}
                    <span className="ml-1.5 text-xs opacity-60">{d.count.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {themes.length > 0 && (
        <Collapsible open={themesOpen} onOpenChange={setThemesOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between border-b pb-2 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: themesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                Themes
              </span>
              <span className="text-xs text-muted-foreground">
                {(value.themes?.length ?? 0) > 0 ? `${value.themes!.length} selected` : 'All'}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-2 pt-3">
              {themes.map((t) => {
                const selected = (value.themes ?? []).includes(t.name)
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => toggleTheme(t.name)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {t.displayName}
                    <span className="ml-1.5 text-xs opacity-60">{t.count.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={openingOpen} onOpenChange={setOpeningOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: openingOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              Openings
            </span>
            {openingValue.items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {openingValue.items.length} selected
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
            <OpeningSelector
              value={openingValue}
              onChange={handleOpeningChange}
              disabled={disabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
