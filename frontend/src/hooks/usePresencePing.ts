import { useEffect } from 'react'
import { api } from '../lib/api'

const PING_INTERVAL_MS = 2 * 60 * 1000

export function usePresencePing(): void {
  useEffect(() => {
    const ping = (): void => { api.auth.ping().catch(() => {}) }

    ping()

    const interval = setInterval(ping, PING_INTERVAL_MS)

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
