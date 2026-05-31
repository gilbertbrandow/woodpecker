import { toast } from './toast'
import * as Sentry from '@sentry/react'
import { navigateTo } from './navigation'

const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
  ) {
    super(`${title}: ${detail}`)
    this.name = 'ApiError'
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...init,
    })
  } catch {
    toast.error('Network error', { description: 'Check your connection and try again.' })
    throw new ApiError(0, 'Network error', 'Check your connection and try again.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { title?: string; detail?: string }
    const title = body.title ?? response.statusText
    const detail = body.detail ?? 'An unexpected error occurred. Please try again.'
    const err = new ApiError(response.status, title, detail)

    if (response.status === 401) {
      navigateTo('/')
      throw err
    }

    toast.error(title, { description: detail })
    throw err
  }

  if (response.status === 204) return undefined as T

  return (response.json() as Promise<T>).catch(() => {
    const parseErr = new ApiError(
      response.status,
      'Something went wrong',
      'An unexpected error occurred. Please try again.',
    )
    toast.error(parseErr.title, { description: parseErr.detail })
    Sentry.captureException(parseErr)
    throw parseErr
  })
}
