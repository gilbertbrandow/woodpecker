// PROTOTYPE — throwaway. Delete once a pagination variant is chosen.
// Three variants of server-pagination + rows-per-page selector, switchable via ?variant=A|B|C

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { PageWrapper } from '../components/PageWrapper'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TOTAL_ROWS = 247
const PAGE_SIZES = [10, 20, 50, 100]

type MockRow = { id: number; name: string; status: string; score: string; date: string }

function makePage(page: number, pageSize: number): MockRow[] {
  const statuses = ['Passed', 'Failed', 'Skipped']
  return Array.from({ length: Math.min(pageSize, TOTAL_ROWS - (page - 1) * pageSize) }, (_, i) => {
    const n = (page - 1) * pageSize + i + 1
    return {
      id: n,
      name: `Training item #${n}`,
      status: statuses[n % 3],
      score: `${Math.round(60 + (n * 17) % 40)}%`,
      date: `2025-0${(n % 9) + 1}-${String((n % 28) + 1).padStart(2, '0')}`,
    }
  })
}

function totalPages(pageSize: number) {
  return Math.max(1, Math.ceil(TOTAL_ROWS / pageSize))
}

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function rowRange(page: number, pageSize: number) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, TOTAL_ROWS)
  return { start, end }
}

// ---------------------------------------------------------------------------
// Variant A — Minimal+ (extend current design with rows-per-page inline)
// Left: "Rows per page [select]"   Centre: "X–Y of Z"   Right: "← Prev  1/12  Next →"
// ---------------------------------------------------------------------------

function VariantA({
  page, pageSize, onPageChange, onPageSizeChange,
}: {
  page: number; pageSize: number
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void
}) {
  const pages = totalPages(pageSize)
  const { start, end } = rowRange(page, pageSize)
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1) }}>
          <SelectTrigger className="h-7 w-auto px-2 text-xs [&>span]:overflow-visible">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>/ Page</span>
      </div>
      <span className="tabular-nums">{`Showing ${start}–${end} of ${TOTAL_ROWS}`}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-3 w-3" />
          Prev
        </button>
        <span className="tabular-nums">{page} / {pages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variant B — Numbered pages
// Row 1: "[20▼ rows]"  "X–Y of Z"
// Row 2: [⟨] [←] [1] … [3] [4] [5] … [25] [→] [⟩]
// ---------------------------------------------------------------------------

function getPageNumbers(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, '…', pages]
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages]
  return [1, '…', page - 1, page, page + 1, '…', pages]
}

function VariantB({
  page, pageSize, onPageChange, onPageSizeChange,
}: {
  page: number; pageSize: number
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void
}) {
  const pages = totalPages(pageSize)
  const { start, end } = rowRange(page, pageSize)
  const pageNums = getPageNumbers(page, pages)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1) }}>
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>rows per page</span>
        </div>
        <span className="tabular-nums">{`${start}–${end} of ${TOTAL_ROWS}`}</span>
      </div>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageNums.map((n, i) =>
          n === '…' ? (
            <span
              key={`dot-${i}`}
              className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n as number)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded text-xs tabular-nums transition-colors',
                n === page
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="flex h-7 w-7 items-center justify-center rounded text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pages)}
          disabled={page >= pages}
          className="flex h-7 w-7 items-center justify-center rounded text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variant C — Unified compact bar (everything centred in one row)
// [←]  Page 3 of 12  [→]  ·  21–40 of 247  ·  [20/page▼]
// ---------------------------------------------------------------------------

function VariantC({
  page, pageSize, onPageChange, onPageSizeChange,
}: {
  page: number; pageSize: number
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void
}) {
  const pages = totalPages(pageSize)
  const { start, end } = rowRange(page, pageSize)
  return (
    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex h-7 w-7 items-center justify-center rounded border border-input transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="tabular-nums font-medium text-foreground">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="flex h-7 w-7 items-center justify-center rounded border border-input transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <span className="text-border select-none">·</span>
      <span className="tabular-nums">{`${start}–${end} of ${TOTAL_ROWS}`}</span>
      <span className="text-border select-none">·</span>
      <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1) }}>
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((s) => (
            <SelectItem key={s} value={String(s)} className="text-xs">{s} / page</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Floating prototype switcher
// ---------------------------------------------------------------------------

const VARIANTS = ['A', 'B', 'C'] as const
type Variant = (typeof VARIANTS)[number]

const VARIANT_NAMES: Record<Variant, string> = {
  A: 'Minimal+',
  B: 'Numbered pages',
  C: 'Unified bar',
}

function readVariantFromUrl(): Variant {
  const raw = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return (VARIANTS as readonly string[]).includes(raw ?? '') ? (raw as Variant) : 'A'
}

function PrototypeSwitcher({ current, onGo }: { current: Variant; onGo: (v: Variant) => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) return
      const idx = VARIANTS.indexOf(current)
      if (e.key === 'ArrowLeft') onGo(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length])
      if (e.key === 'ArrowRight') onGo(VARIANTS[(idx + 1) % VARIANTS.length])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, onGo])

  const idx = VARIANTS.indexOf(current)
  const prev = VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length]
  const next = VARIANTS[(idx + 1) % VARIANTS.length]

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 shadow-lg text-sm">
        <button
          type="button"
          onClick={() => onGo(prev)}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-medium select-none min-w-[9rem] text-center">
          {current} — {VARIANT_NAMES[current]}
        </span>
        <button
          type="button"
          onClick={() => onGo(next)}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mock table
// ---------------------------------------------------------------------------

function MockTable({ rows }: { rows: MockRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">#</TableHead>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Score</TableHead>
            <TableHead className="text-xs">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs tabular-nums text-muted-foreground">{row.id}</TableCell>
              <TableCell className="text-xs font-medium">{row.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.status}</TableCell>
              <TableCell className="text-xs tabular-nums">{row.score}</TableCell>
              <TableCell className="text-xs tabular-nums text-muted-foreground">{row.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PaginationPrototypePage() {
  const [variant, setVariant] = useState<Variant>(readVariantFromUrl)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  function handleGo(v: Variant) {
    setVariant(v)
    const params = new URLSearchParams(window.location.search)
    params.set('variant', v)
    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`)
  }

  function handlePageSizeChange(s: number) {
    setPageSize(s)
    setPage(1)
  }

  const rows = makePage(page, pageSize)

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Pagination prototype</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Three variants — use ← → arrow keys or the switcher below to toggle.
          Showing {TOTAL_ROWS} simulated rows.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <MockTable rows={rows} />
        {variant === 'A' && (
          <VariantA page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        )}
        {variant === 'B' && (
          <VariantB page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        )}
        {variant === 'C' && (
          <VariantC page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        )}
      </div>

      <PrototypeSwitcher current={variant} onGo={handleGo} />
    </PageWrapper>
  )
}
