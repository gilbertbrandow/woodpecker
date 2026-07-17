import { useRef, useEffect, useCallback } from 'react'

export type SoundEvent = 'move' | 'capture' | 'check'

const SOUND_FILES: Record<SoundEvent, string> = {
  move: 'Move.ogg',
  capture: 'Capture.ogg',
  check: 'Check.ogg',
}

export function useBoardSounds(enabled: boolean, theme: string): (event: SoundEvent) => void {
  const audioRef = useRef<Partial<Record<SoundEvent, HTMLAudioElement>>>({})
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const audio: Partial<Record<SoundEvent, HTMLAudioElement>> = {}
    for (const [event, file] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
      const el = new Audio(`/sounds/${theme}/${file}`)
      el.preload = 'auto'
      audio[event as SoundEvent] = el
    }
    audioRef.current = audio
  }, [theme])

  return useCallback((event: SoundEvent) => {
    if (!enabledRef.current) return
    const el = audioRef.current[event]
    if (!el) return
    el.currentTime = 0
    void el.play().catch(() => {})
  }, [])
}

export function sanToSoundEvents(san: string): SoundEvent[] {
  const events: SoundEvent[] = []
  events.push(san.includes('x') ? 'capture' : 'move')
  if (san.endsWith('+') || san.endsWith('#')) events.push('check')
  return events
}
