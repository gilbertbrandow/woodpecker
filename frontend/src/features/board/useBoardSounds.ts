import { useRef, useEffect, useCallback } from 'react'

export type SoundEvent = 'move' | 'capture' | 'check'

const SOUND_FILES: Record<SoundEvent, string> = {
  move: 'Move.ogg',
  capture: 'Capture.ogg',
  check: 'Check.ogg',
}

export function useBoardSounds(enabled: boolean, theme: string): (event: SoundEvent) => void {
  const ctxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Partial<Record<SoundEvent, AudioBuffer>>>({})
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioContext()
    const ctx = ctxRef.current
    buffersRef.current = {}
    const controller = new AbortController()
    for (const [event, file] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
      void fetch(`/sounds/${theme}/${file}`, { signal: controller.signal })
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => { buffersRef.current[event as SoundEvent] = buf })
        .catch(() => {})
    }
    return () => { controller.abort() }
  }, [theme])

  useEffect(() => {
    return () => { void ctxRef.current?.close() }
  }, [])

  return useCallback((event: SoundEvent) => {
    if (!enabledRef.current) return
    const buf = buffersRef.current[event]
    if (!buf) return
    const ctx = ctxRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
  }, [])
}

export function sanToSoundEvents(san: string): SoundEvent[] {
  const events: SoundEvent[] = []
  events.push(san.includes('x') ? 'capture' : 'move')
  if (san.endsWith('+') || san.endsWith('#')) events.push('check')
  return events
}
