import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { useDebounce } from './useDebounce'

type Options<T extends { id: number }> = {
  value: T[]
  onChange: (items: T[]) => void
  fetchResults: (query: string) => Promise<T[]>
  fetchSuggestions?: () => Promise<T[]>
  minQueryLength?: number
}

export function useEntitySearch<T extends { id: number }>({
  value,
  onChange,
  fetchResults,
  fetchSuggestions,
  minQueryLength = 2,
}: Options<T>) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<T[]>([])
  const debouncedQuery = useDebounce(query, 300)

  // Refs keep callbacks stable so effects don't re-subscribe on every render.
  const fetchResultsRef = useRef(fetchResults)
  fetchResultsRef.current = fetchResults
  const fetchSuggestionsRef = useRef(fetchSuggestions)
  fetchSuggestionsRef.current = fetchSuggestions

  useEffect(() => {
    if (!fetchSuggestionsRef.current) return
    let cancelled = false
    fetchSuggestionsRef.current()
      .then((r) => { if (!cancelled) setSuggestions(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, []) // runs once on mount — fetchSuggestions is accessed via ref

  useEffect(() => {
    if (debouncedQuery.length < minQueryLength) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    fetchResultsRef.current(debouncedQuery)
      .then((r) => { if (!cancelled) setResults(r) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, minQueryLength]) // fetchResults is accessed via ref

  const isSearching = debouncedQuery.length >= minQueryLength

  const toggle = useCallback(
    (item: T) => {
      const already = value.some((v) => v.id === item.id)
      onChange(already ? value.filter((v) => v.id !== item.id) : [...value, item])
    },
    [value, onChange],
  )

  const remove = useCallback(
    (id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(value.filter((v) => v.id !== id))
    },
    [value, onChange],
  )

  return { query, setQuery, results, searching, suggestions, isSearching, toggle, remove }
}
