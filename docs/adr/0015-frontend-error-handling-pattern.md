# Frontend error handling pattern

All API error side-effects are handled as close to the `request()` wrapper as possible, following the interceptor pattern. The wrapper itself handles the two global concerns: `401` triggers an immediate redirect to the login page (using the exported router instance, callable outside React); `500` shows a generic toast and calls `Sentry.captureException()`. These never need per-call-site handling.

For contextual errors (`422`, `409`), `request()` throws an `ApiError` carrying the backend message. Call sites pass the caught error to a small `reportError(err)` helper that shows `toast.error(err.message)` for those two codes and is silent for everything else. Every catch block becomes a one-liner: `catch (err) { reportError(err) }`. Call sites that need custom behaviour (e.g. returning `null` on `404`) simply do not call `reportError`.

This pattern accepts one deliberate constraint: `422` validation errors always surface as toasts, never as inline form field messages. The app's forms are simple enough (mostly single-field inputs) that inline validation does not justify the added complexity of passing errors back up through the call stack. If a future form genuinely needs inline field errors, the call site can catch `ApiError` directly and handle it without calling `reportError`.

`400` and `403` errors are treated as developer signals — they indicate a frontend bug (sending a malformed request) or a missing UI guard (a button that should have been disabled). They are logged to the console only, not shown to the user.
