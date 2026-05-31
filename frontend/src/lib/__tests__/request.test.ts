import { describe, it, expect, vi, beforeEach } from 'vitest'
import { request, ApiError } from '../request'
import { toast } from '../toast'
import { navigateTo } from '../navigation'
import * as Sentry from '@sentry/react'

vi.mock('../toast', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('../navigation', () => ({
  navigateTo: vi.fn(),
}))

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}))

// Partial HTTP status text map for building mock responses
const STATUS_TEXT: Record<number, string> = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}

function stubFetch({ status, body, jsonFails = false }: {
  status: number
  body?: unknown
  jsonFails?: boolean
}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: STATUS_TEXT[status] ?? 'OK',
    json: jsonFails
      ? () => Promise.reject(new SyntaxError('Unexpected token'))
      : () => body !== undefined
        ? Promise.resolve(body)
        : Promise.reject(new SyntaxError('Empty body')),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('request', () => {
  describe('network failure', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    })

    it('toasts a network error with a connection message', async () => {
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Network error', {
        description: 'Check your connection and try again.',
      })
    })

    it('throws ApiError with status 0', async () => {
      const err = await request('/test').catch((e: unknown) => e) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(0)
    })

    it('does not navigate or report to Sentry', async () => {
      await request('/test').catch(() => {})
      expect(navigateTo).not.toHaveBeenCalled()
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('401 Unauthorized', () => {
    beforeEach(() => {
      stubFetch({ status: 401 })
    })

    it('navigates to the login page', async () => {
      await request('/test').catch(() => {})
      expect(navigateTo).toHaveBeenCalledWith('/')
    })

    it('does not show a toast — the redirect is the only signal', async () => {
      await request('/test').catch(() => {})
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('throws ApiError with status 401', async () => {
      const err = await request('/test').catch((e: unknown) => e) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(401)
    })

    it('does not report to Sentry', async () => {
      await request('/test').catch(() => {})
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('4xx / 5xx error response', () => {
    it('toasts with the backend title and detail verbatim', async () => {
      stubFetch({ status: 422, body: { title: 'Name required', detail: 'Please provide a name for the subset.' } })
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Name required', {
        description: 'Please provide a name for the subset.',
      })
    })

    it('throws ApiError carrying the status, title, and detail', async () => {
      stubFetch({ status: 409, body: { title: 'Already enrolled', detail: 'You are already enrolled in this schedule.' } })
      const err = await request('/test').catch((e: unknown) => e) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(409)
      expect(err.title).toBe('Already enrolled')
      expect(err.detail).toBe('You are already enrolled in this schedule.')
    })

    it('sets the error message to "title: detail" for Sentry grouping', async () => {
      stubFetch({ status: 422, body: { title: 'Name required', detail: 'Please provide a name.' } })
      const err = await request('/test').catch((e: unknown) => e) as ApiError
      expect(err.message).toBe('Name required: Please provide a name.')
    })

    it('falls back to statusText when the body omits title', async () => {
      stubFetch({ status: 403, body: { detail: 'Not your resource.' } })
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Forbidden', expect.anything())
    })

    it('falls back to a generic detail when the body omits detail', async () => {
      stubFetch({ status: 404, body: { title: 'Not found' } })
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Not found', {
        description: 'An unexpected error occurred. Please try again.',
      })
    })

    it('falls back to statusText and generic detail when the body is not JSON', async () => {
      stubFetch({ status: 500, jsonFails: true })
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Internal Server Error', {
        description: 'An unexpected error occurred. Please try again.',
      })
    })

    it('does not navigate or report to Sentry', async () => {
      stubFetch({ status: 422, body: { title: 'X', detail: 'Y' } })
      await request('/test').catch(() => {})
      expect(navigateTo).not.toHaveBeenCalled()
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('204 No Content', () => {
    beforeEach(() => {
      stubFetch({ status: 204 })
    })

    it('returns undefined', async () => {
      const result = await request('/test')
      expect(result).toBeUndefined()
    })

    it('does not toast or navigate', async () => {
      await request('/test')
      expect(toast.error).not.toHaveBeenCalled()
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })

  describe('successful 200 response', () => {
    it('returns the parsed response body', async () => {
      stubFetch({ status: 200, body: { id: 42, name: 'Woodpecker' } })
      const result = await request<{ id: number; name: string }>('/test')
      expect(result).toEqual({ id: 42, name: 'Woodpecker' })
    })

    it('prefixes the path with /api', async () => {
      stubFetch({ status: 200, body: {} })
      await request('/subsets/1')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/subsets/1', expect.any(Object))
    })

    it('sends JSON Content-Type and same-origin credentials by default', async () => {
      stubFetch({ status: 200, body: {} })
      await request('/test')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      }))
    })

    it('merges caller-provided init over the defaults', async () => {
      stubFetch({ status: 200, body: {} })
      await request('/subsets', { method: 'POST', body: '{"name":"x"}' })
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        method: 'POST',
        body: '{"name":"x"}',
      }))
    })

    it('does not toast, navigate, or report to Sentry', async () => {
      stubFetch({ status: 200, body: {} })
      await request('/test')
      expect(toast.error).not.toHaveBeenCalled()
      expect(navigateTo).not.toHaveBeenCalled()
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('JSON parse failure on a 200 response', () => {
    beforeEach(() => {
      stubFetch({ status: 200, jsonFails: true })
    })

    it('shows a generic error toast', async () => {
      await request('/test').catch(() => {})
      expect(toast.error).toHaveBeenCalledWith('Something went wrong', {
        description: 'An unexpected error occurred. Please try again.',
      })
    })

    it('reports the parse failure to Sentry', async () => {
      await request('/test').catch(() => {})
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(ApiError))
    })

    it('throws ApiError', async () => {
      const err = await request('/test').catch((e: unknown) => e) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.title).toBe('Something went wrong')
    })

    it('does not navigate', async () => {
      await request('/test').catch(() => {})
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })
})
