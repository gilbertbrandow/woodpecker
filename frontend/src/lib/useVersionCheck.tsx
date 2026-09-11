import { useEffect } from 'react'
import { toast } from './toast'

const POLL_INTERVAL_MS = 5 * 60 * 1000

// Returns the pathname of the currently-loaded hashed main bundle, e.g.
// "/assets/index.abc123.js". Returns null during dev (no hash in filename).
function currentBundlePath(): string | null {
  for (const el of document.querySelectorAll<HTMLScriptElement>('script[src]')) {
    const url = new URL(el.src, location.origin)
    if (/\/assets\/index\.[^/]+\.js$/.test(url.pathname)) return url.pathname
  }
  return null
}

function showUpdateToast() {
  toast.info('Update available', {
    description: (
      <span>
        A new version is available,{' '}
        <button onClick={() => location.reload()} className="cursor-pointer underline">
          please reload.
        </button>
      </span>
    ),
    duration: Infinity,
  })
}

export function useVersionCheck(): void {
  useEffect(() => {
    const bundlePath: string | null = currentBundlePath()
    if (!bundlePath) return  // no hash in filename — unexpected in prod
    const path: string = bundlePath

    let toastShown = false

    async function check() {
      if (toastShown) return
      try {
        const res = await fetch('/index.html', { cache: 'no-store' })
        if (!res.ok) return  // server error / deploy in progress — skip to avoid spurious toast
        const html = await res.text()
        if (!html.includes(path)) {
          toastShown = true
          showUpdateToast()
        }
      } catch {
        // Ignore — user is offline or request failed
      }
    }

    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
