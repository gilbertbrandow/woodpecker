import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'

const MIN_COUNT = 5
const MAX_COUNT = 1000

export function SubsetNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [puzzleCount, setPuzzleCount] = useState('100')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return null

  const countValue = parseInt(puzzleCount, 10)
  const countValid = !isNaN(countValue) && countValue >= MIN_COUNT && countValue <= MAX_COUNT
  const canSubmit = name.trim().length > 0 && countValid && !submitting

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const subset = await api.subsets.create(name.trim(), countValue)
      void navigate({ to: '/app/subsets/$subsetId', params: { subsetId: String(subset.id) } })
    } catch {
      toast.error('Failed to create subset', { description: 'Please try again.' })
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Subsets</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New subset</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-6 text-xl font-semibold">New subset</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="subset-name">
            Subset name
          </label>
          <Input
            id="subset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tactical patterns 1800–2000"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="puzzle-count">
            Puzzle count
          </label>
          <Input
            id="puzzle-count"
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={puzzleCount}
            onChange={(e) => setPuzzleCount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Between {MIN_COUNT} and {MAX_COUNT}.</p>
        </div>

        <Button type="submit" disabled={!canSubmit} className="mt-2">
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </form>
    </div>
  )
}
