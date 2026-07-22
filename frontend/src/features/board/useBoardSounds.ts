import { useRef, useEffect, useCallback } from 'react'

export type SoundEvent = 'move' | 'capture' | 'check'

const SOUND_FILES: Record<SoundEvent, string> = {
  move: 'Move.ogg',
  capture: 'Capture.ogg',
  check: 'Check.ogg',
}

// If the buffer isn't ready when play() is called, queue the sound and play it
// as soon as decoding finishes — but only within this window. Stale sounds
// (e.g. a queued opponent move whose visual already happened 800ms ago) are
// discarded so they don't play at a confusing time.
const PENDING_DEADLINE_MS = 750

function playNow(ctx: AudioContext, buf: AudioBuffer): void {
  if (ctx.state === 'suspended') void ctx.resume()
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
}

export function useBoardSounds(enabled: boolean, theme: string): (event: SoundEvent) => void {
  const ctxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Partial<Record<SoundEvent, AudioBuffer>>>({})
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const pendingRef = useRef<{ event: SoundEvent; deadline: number }[]>([])

  useEffect(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioContext()
    const ctx = ctxRef.current
    buffersRef.current = {}
    pendingRef.current = []
    const controller = new AbortController()
    for (const [event, file] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
      void fetch(`/sounds/${theme}/${file}`, { signal: controller.signal })
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => {
          buffersRef.current[event as SoundEvent] = buf
          if (!enabledRef.current) return
          const now = performance.now()
          const idx = pendingRef.current.findIndex((p) => p.event === event && p.deadline > now)
          if (idx !== -1) {
            pendingRef.current.splice(idx, 1)
            playNow(ctx, buf)
          }
        })
        .catch(() => {})
    }
    return () => { controller.abort() }
  }, [theme])

  useEffect(() => {
    return () => { void ctxRef.current?.close() }
  }, [])

  return useCallback((event: SoundEvent) => {
    if (!enabledRef.current) return
    const ctx = ctxRef.current
    if (!ctx) return
    const buf = buffersRef.current[event]
    if (!buf) {
      pendingRef.current.push({ event, deadline: performance.now() + PENDING_DEADLINE_MS })
      return
    }
    playNow(ctx, buf)
  }, [])
}

export function sanToSoundEvents(san: string): SoundEvent[] {
  const events: SoundEvent[] = []
  events.push(san.includes('x') ? 'capture' : 'move')
  if (san.endsWith('+') || san.endsWith('#')) events.push('check')
  return events
}
