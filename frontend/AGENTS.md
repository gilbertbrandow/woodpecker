# Frontend Agent Guide

## Error handling and toasts

### The one import rule

Always import `toast` from `src/lib/toast`, never from `sonner` directly:

```typescript
import { toast } from '../lib/toast'   // correct
import { toast } from 'sonner'         // wrong — bypasses icons and the design seam
```

The only legitimate exceptions are `main.tsx` (mounts `<Toaster />`) and `ToastPrototypePage.tsx` (uses raw sonner for design comparison).

### Call-site patterns

**Mutation with success feedback:**

```typescript
try {
  const result = await api.subsets.create(name)
  toast.success('Subset created', { description: `"${name}" has been added.` })
  void navigate({ to: '/app/subsets/$subsetId', params: { subsetId: String(result.id) } })
} catch {
  // empty — request() already showed the error toast
}
```

**Mutation that must reset UI state on failure:**

```typescript
setSubmitting(true)
try {
  await api.subsets.delete(id)
  void navigate({ to: '/app/subsets' })
} catch {
  setSubmitting(false)  // the only reason to catch — re-enable the button
}
```

**Mutation with no user feedback needed:**

```typescript
try {
  await api.settings.update(payload)
} catch {
  // empty
}
```

### What not to do

**Don't call `toast.error()` in feature code.** `request()` already called it before throwing. A second `toast.error` means the user sees two toasts for the same error.

**Don't inspect the caught error.** `request()` has already branched on HTTP status. Call sites never need to read `err.status`, `err.title`, or `err.detail`.

**Don't call `Sentry.captureException()` in feature code.** Frontend Sentry is reserved for browser-originated errors (JSON parse failures, React render crashes). Backend errors are already in backend Sentry with full stack traces — a duplicate frontend event adds noise without signal.

**Don't remove empty catch blocks.** They look like noise but serve two purposes: they prevent unhandled promise rejection warnings, and they prevent Sentry's `unhandledrejection` handler from double-capturing errors that `request()` already reported.

### Toast variant guide

| Variant | When |
| --------- | ------ |
| `toast.success()` | Mutation completed — something was created, saved, deleted, or locked |
| `toast.info()` | Something happened the user should know but didn't directly trigger (e.g. run started automatically) |
| `toast.warning()` | Action completed but with a caveat (e.g. only 87 of 100 puzzles could be sourced) |
| `toast.error()` | Only inside `request()` — never in feature code |

### Module map

| Module | Responsibility |
| -------- | --------------- |
| `src/lib/request.ts` | HTTP machinery: `request()`, `ApiError`, all error side-effects (toast, redirect, Sentry) |
| `src/lib/api.ts` | API surface: typed method wrappers and all domain types. No branching logic. |
| `src/lib/toast.tsx` | Toast wrapper: injects variant-matching icons, enforces the single import seam |

`request()` is the only place that should ever call `toast.error`, `navigateTo('/')`, or `Sentry.captureException`. Adding any of these three in feature code is always wrong.

## Data tables

All server-paginated, filterable tables use `ServerDataTable` from
`src/components/ServerDataTable.tsx`. Never build ad-hoc pagination loops;
always reach for this component.

### Minimal wiring

```typescript
<ServerDataTable
  columns={columns}
  pageSize={20}
  initialSorting={[{ id: 'createdAt', desc: true }]}
  fetchData={async ({ filters, page, pageSize }) =>
    api.things.list({ ...filters, page, pageSize })
  }
/>
```

`fetchData` receives `{ filters: Record<string, string[]>, page, pageSize }`.
Pass it straight to the API layer — never parse filters in the component.

### Filter specs → backend methods

Declare filters as `FilterSpec[]` on the `filters` prop. The component handles
rendering chips, URL sync, and serialising values into the `filters` dict that
`fetchData` receives. Each type maps to a specific backend `TableQuery` method:

| Frontend `type` | Value type | Backend method |
| --------------- | ---------- | -------------- |
| `'search'` — key **must** be `'q'` | `string` | `q.q` (not a filter method) |
| `'multi'` | `MultiVal` (`op` + `values: string[]`) | `q.str_filter(key)` |
| `'entity'` | `EntityVal` (`op` + `items: T[]`) | `q.int_filter(key)` |
| `'set'` | `SetVal` (`op` + `items: T[]`) | `q.set_filter(key)` |
| `'date'` | `DateVal` (`op` + `from`/`to`) | `q.date_filter(key)` |
| `'range'` | `RangeVal` (`op` + `from`/`to`) | `q.range_filter(key)` |
| `'custom'` | `T[]` | `q.str_filter(key)` or `q.int_filter(key)` (depends on `serialize`) |

### Key props

| Prop | Purpose |
| ---- | ------- |
| `tableId` | Namespaces URL params when multiple tables share a page — e.g. `"run"` → `?run_userId=…` |
| `initialData` | Pre-seeds data to skip the first fetch; the component only re-fetches when filters/page change |
| `refreshKey` | Increment to imperatively trigger a re-fetch (e.g. after a delete) |
| `instanceKey` | Change when the data source identity changes without unmounting (e.g. a `scheduleId` prop changes) |
| `onDataChange` | Side-effect callback `(items, total)` — sync a count badge or parent state without lifting all data up |
| `initialCustomValues` | Pre-seed a filter value at mount when no URL param is present (e.g. current user pre-selected) |

## Sentry

- **Captures:** JSON parse failures on 2xx responses (backend contract violation) and React render crashes via `Sentry.ErrorBoundary`
- **Does not capture:** 4xx or 5xx API errors — the backend already has them
- **User context:** set via `Sentry.setUser({ id })` when auth resolves in `src/context/auth.tsx`
- **Environment:** Vite's `import.meta.env.MODE` (typically `"development"` or `"production"`)
- **DSN:** `VITE_SENTRY_DSN` env var — Sentry is disabled when unset (local dev default)
