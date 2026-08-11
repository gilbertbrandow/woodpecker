import * as React from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { DataTable, col } from '../DataTable'
import type { StockFeatures } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'

vi.mock('../../hooks/useTableUrlSync', () => ({
  useTableUrlSync: () => ({
    getParam: () => null,
    getMultiParam: () => [],
    setParams: () => {},
  }),
}))

type Row = { id: number; name: string; score: number }

const columns: ColumnDef<StockFeatures, Row>[] = [
  col<Row>({
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    meta: { icon: () => <span /> },
  }),
  {
    id: 'score',
    header: 'Score',
    accessorKey: 'score',
  },
]

const data: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 70 },
  { id: 3, name: 'Charlie', score: 80 },
]

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function nameOrder() {
  return screen
    .getAllByRole('cell')
    .map((c) => c.textContent)
    .filter((t) => ['Alice', 'Bob', 'Charlie'].includes(t ?? ''))
}

describe('DataTable', () => {
  it('renders all rows', () => {
    wrap(<DataTable columns={columns} data={data} tableId={false} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('renders column headers with sort buttons', () => {
    wrap(<DataTable columns={columns} data={data} tableId={false} />)
    expect(screen.getByRole('button', { name: /Name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Score/i })).toBeInTheDocument()
  })

  it('applies initialSorting (ascending by score)', () => {
    wrap(
      <DataTable
        columns={columns}
        data={data}
        tableId={false}
        initialSorting={[{ id: 'score', desc: false }]}
      />,
    )
    expect(nameOrder()).toEqual(['Bob', 'Charlie', 'Alice'])
  })

  it('applies initialSorting (descending by score)', () => {
    wrap(
      <DataTable
        columns={columns}
        data={data}
        tableId={false}
        initialSorting={[{ id: 'score', desc: true }]}
      />,
    )
    expect(nameOrder()).toEqual(['Alice', 'Charlie', 'Bob'])
  })

  it('renders the search input', () => {
    wrap(<DataTable columns={columns} data={data} tableId={false} />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('shows empty message when data is empty', () => {
    wrap(<DataTable columns={columns} data={[]} tableId={false} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows spinner when loading with no data', () => {
    const { container } = wrap(<DataTable columns={columns} data={[]} loading tableId={false} />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
