import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { BoardSurface } from '../BoardSurface'
import { buildLivePgnDisplay, resolveDisplayBoard } from '../boardPage.helpers'
import type { BoardState, PlySelection } from '../boardPage.helpers'

const PRELUDE = ['e2e4', 'e7e5']
const PUZZLE_START_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
const PLIES_PLAYED = ['g1f3', 'b8c6', 'f1b5']
const LIVE_PGN = buildLivePgnDisplay(PUZZLE_START_FEN, PLIES_PLAYED, undefined, [], [], PRELUDE)
const HEAD_INDEX = LIVE_PGN.mainline.length - 1
const FIRST_PRELUDE_MOVE: PlySelection = { line: 'main', index: 0 }
const HEAD_MOVE: PlySelection = { line: 'main', index: HEAD_INDEX }

function controllerBoard(lastMove: [string, string] | undefined): BoardState {
  return {
    boardKey: 1,
    boardSize: 400,
    fen: LIVE_PGN.mainline[HEAD_INDEX].fen,
    orientation: 'black',
    dests: new Map([['g8', ['f6']]]),
    lastMove,
    hintSquare: null,
    pendingPromotion: null,
    moveFeedback: { result: null, square: null, visible: false },
    turnToMove: 'black',
    kingPieceUrl: '',
    darkKingPieceUrl: '',
  }
}

function BoardAt({ board }: { board: BoardState }): React.ReactElement {
  return (
    <BoardSurface
      boardKey={board.boardKey}
      boardSize={board.boardSize}
      fen={board.fen}
      orientation={board.orientation}
      dests={board.dests}
      lastMove={board.lastMove}
      hintSquare={board.hintSquare}
      pendingPromotion={board.pendingPromotion}
      moveFeedback={board.moveFeedback}
      animationEnabled={false}
      onMove={() => {}}
      onPromotionSelect={() => {}}
      onPromotionCancel={() => {}}
    />
  )
}

function displayed(board: BoardState, selectedPly: PlySelection | null): BoardState {
  return resolveDisplayBoard(board, 'focus', selectedPly, LIVE_PGN, null, null)
}

type KeyedElement = Element & { cgKey?: string }

function highlightedSquares(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<KeyedElement>('square.last-move'))
    .map(el => el.cgKey ?? '')
    .sort()
}

describe('BoardSurface last-move highlight', () => {
  it('highlights the live last move after clicking an earlier PGN move and then the head move', async () => {
    const live = controllerBoard(['f1', 'b5'])
    const { container, rerender } = render(<BoardAt board={displayed(live, null)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['b5', 'f1']))

    rerender(<BoardAt board={displayed(live, FIRST_PRELUDE_MOVE)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['e2', 'e4']))

    rerender(<BoardAt board={displayed(live, HEAD_MOVE)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['b5', 'f1']))
  })

  it('leaves the caller lastMove untouched when another move is displayed', async () => {
    const liveLastMove: [string, string] = ['f1', 'b5']
    const live = controllerBoard(liveLastMove)
    const { container, rerender } = render(<BoardAt board={displayed(live, null)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['b5', 'f1']))

    rerender(<BoardAt board={displayed(live, FIRST_PRELUDE_MOVE)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['e2', 'e4']))

    expect(liveLastMove).toEqual(['f1', 'b5'])
  })

  it('removes the highlight when lastMove becomes undefined', async () => {
    const { container, rerender } = render(<BoardAt board={controllerBoard(['f1', 'b5'])} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual(['b5', 'f1']))

    rerender(<BoardAt board={controllerBoard(undefined)} />)
    await waitFor(() => expect(highlightedSquares(container)).toEqual([]))
  })
})
