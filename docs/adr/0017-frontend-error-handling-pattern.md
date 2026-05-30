# Frontend error handling pattern

supersedes: ADR-0015

All API error side-effects are centralised in `request()`. The frontend branches only on HTTP status category — never on a semantic code string in the body. The rules are: `401` → redirect to login; `4xx` → `toast.error(title, { description: detail })` using the backend's copy verbatim; `5xx` → generic toast only; network failure → connection error toast. No call site needs to inspect the error to decide what to show.

5xx errors are intentionally not sent to frontend Sentry. The backend already captures server errors with full stack traces; a duplicate frontend event would add noise without adding signal. Frontend Sentry is reserved for errors that originate in the browser: JSON parse failures (a backend contract violation the server never sees), and React render crashes caught by `ErrorBoundary`.

`ApiError` carries `status`, `title`, and `detail`. Its `message` (inherited from `Error`) is set to `"${title}: ${detail}"` so Sentry's default grouping and search surface the full context without needing to dig into breadcrumbs.

Call sites keep empty `catch` blocks (`catch { }` or `.catch(() => {})`). These look like noise but serve two purposes: they prevent unhandled promise rejection warnings in the browser, and they prevent Sentry double-capturing errors that `request()` already reported via `captureException`. Removing them would cause the browser's `unhandledrejection` handler — which Sentry listens to by default — to capture the same 500 errors a second time.

The `reportError()` helper from ADR-0015 was deleted. The `suppressToastFor` escape hatch (used to suppress 404 toasts for `getMyTraining`) was eliminated by changing that endpoint to return `200` with a nullable body rather than `404` — removing the only case where a 4xx was a valid non-error state.
