import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBoardSounds } from '../useBoardSounds'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuffer(): AudioBuffer { return {} as AudioBuffer }

// Let the microtask queue drain fully before continuing. The promise chain
// inside the hook (fetch → arrayBuffer → decodeAudioData → pending flush)
// is four microtask hops; a single macrotask after them guarantees they're
// all settled.
function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

// ---------------------------------------------------------------------------
// Web Audio API stub
// ---------------------------------------------------------------------------

type FakeSourceNode = { buffer: AudioBuffer | null; connect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }
type FakeAudioContext = {
  state: AudioContext['state']
  destination: object
  createBufferSource: ReturnType<typeof vi.fn>
  decodeAudioData: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useBoardSounds pending-queue behaviour', () => {
  let mockCtx: FakeAudioContext
  // Keyed by full fetch URL so tests can resolve individual event buffers by name.
  let fetchResolvers: Map<string, () => void>

  beforeEach(() => {
    vi.stubGlobal('performance', { now: vi.fn(() => 0) })

    fetchResolvers = new Map()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        new Promise<Response>((resolve) => {
          fetchResolvers.set(url, () =>
            resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) } as unknown as Response),
          )
        }),
      ),
    )

    mockCtx = {
      state: 'running' as AudioContext['state'],
      destination: {},
      createBufferSource: vi.fn(
        (): FakeSourceNode => ({ buffer: null, connect: vi.fn(), start: vi.fn() }),
      ),
      decodeAudioData: vi.fn().mockResolvedValue(makeBuffer()),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Trigger the fetch → arrayBuffer → decodeAudioData chain for one event.
  function resolveBuffer(theme: string, event: 'move' | 'capture' | 'check'): void {
    const fileMap = { move: 'Move.ogg', capture: 'Capture.ogg', check: 'Check.ogg' } as const
    fetchResolvers.get(`/sounds/${theme}/${fileMap[event]}`)?.()
  }

  // ---------------------------------------------------------------------------

  it('plays immediately when the buffer is already loaded before play() is called', async () => {
    const { result } = renderHook(() => useBoardSounds(true, 'standard'))

    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })

    act(() => { result.current('move') })

    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1)
  })

  it('queues the sound and plays it once the buffer finishes loading', async () => {
    const { result } = renderHook(() => useBoardSounds(true, 'standard'))

    // play() before buffer ready — should NOT play yet
    act(() => { result.current('move') })
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled()

    // Buffer arrives — pending sound should fire
    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1)
  })

  it('only flushes the pending sound for the matching event type', async () => {
    const { result } = renderHook(() => useBoardSounds(true, 'standard'))

    // Queue a move sound
    act(() => { result.current('move') })

    // Loading capture and check buffers must NOT trigger the queued move sound
    await act(async () => {
      resolveBuffer('standard', 'capture')
      resolveBuffer('standard', 'check')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled()

    // Loading the move buffer should flush it
    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1)
  })

  it('discards the queued sound once the 750 ms deadline has passed', async () => {
    const nowMock = vi.fn().mockReturnValue(0)
    vi.stubGlobal('performance', { now: nowMock })

    const { result } = renderHook(() => useBoardSounds(true, 'standard'))

    // Sound queued at t = 0, deadline = 750 ms
    act(() => { result.current('move') })

    // Advance mock clock past the deadline before the buffer loads
    nowMock.mockReturnValue(800)

    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled()
  })

  it('discards the queued sound if sounds are disabled before the buffer loads', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useBoardSounds(enabled, 'standard'),
      { initialProps: { enabled: true } },
    )

    act(() => { result.current('move') })

    // Disable sounds while buffer is still loading
    rerender({ enabled: false })

    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled()
  })

  it('clears the pending queue on theme change so a stale sound does not play', async () => {
    const { result, rerender } = renderHook(
      ({ theme }: { theme: string }) => useBoardSounds(true, theme),
      { initialProps: { theme: 'standard' } },
    )

    // Queue a move sound while standard buffers are loading
    act(() => { result.current('move') })

    // Theme change clears pendingRef and starts loading new buffers
    await act(async () => {
      rerender({ theme: 'lichess' })
      await flushMicrotasks() // let the new effect run and clear pendingRef
    })

    // Standard move buffer arrives after the pending queue has been cleared
    await act(async () => {
      resolveBuffer('standard', 'move')
      await flushMicrotasks()
    })
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled()
  })
})
