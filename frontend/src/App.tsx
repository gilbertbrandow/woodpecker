import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type BackendStatus = 'checking...' | 'connected' | 'unexpected response' | 'unreachable'

export default function App(): JSX.Element {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking...')

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((data: { status: string }) => {
        setBackendStatus(data.status === 'ok' ? 'connected' : 'unexpected response')
      })
      .catch(() => setBackendStatus('unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Woodpecker</h1>
      <p>Backend: <strong>{backendStatus}</strong></p>
    </div>
  )
}
