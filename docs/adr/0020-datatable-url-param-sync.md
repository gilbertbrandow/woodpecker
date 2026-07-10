# DataTable owns URL param sync for filter/sort/page state

All DataTable instances automatically sync their filter, sort, and page state to URL search params. The param naming scheme is `{tableId}_q` (search), `{tableId}_sort` (e.g. `name:asc`), `{tableId}_page`, and bare filter keys matching the backend query param name (e.g. `statuses`, `userIds`). When only one DataTable exists on a page, `tableId` is omitted and params are flat (e.g. `?q=foo&page=2`).

## Filter key contract

A filter's `id` (for `filterableColumns`) or `key` (for `syncedFilters`) must match the query param name the backend reads. This keeps the URL, the DataTable prop, and the HTTP request all using the same string — no translation layer.

## Two filter paths

**`filterableColumns`** — for filters whose UI (a `MultiSelectFilter` dropdown) DataTable renders itself. DataTable owns the full lifecycle: URL read on mount, URL write on change, URL clear on "Clear filters". The wrapper receives change notifications via `onFilterChange` and uses them to update its own state for API calls.

**`syncedFilters`** — for filters whose UI the wrapper renders in `filtersSlot` (e.g. `UserSelector`, a custom search input's companion state). The wrapper holds the filter value as React state and passes `{ key, value, onChange }` descriptors to DataTable. DataTable then:

- Writes the values to URL whenever they change (detected via serialised snapshot).
- On first render, writes the initial values — this is how defaults that exist in state before the URL is consulted (e.g. a pre-selected user from auth context) get persisted to the URL.
- Calls `onChange([])` and clears the URL key when "Clear filters" is clicked.

Wrappers read URL once — synchronously, in `useState` lazy initialisers — for state they own (search `q`, `page`, multi-value filters like `statuses`). They never call `setParams` for synced filter keys; that is DataTable's job.

## Opaque entity IDs in URL filters

When a filter stores entity IDs in the URL (e.g. `?userIds=5,6`) but the UI component needs full objects (e.g. `UserSelector` needs `{ id, displayName, avatarUrl }`), use `useUrlHydratedFilter<T>`:

```ts
const { value, setValue, isHydrating, hadInitialIds, syncedFilter } =
  useUrlHydratedFilter<SelectableUser>({
    urlKey: 'userId',
    tableId,
    fetchByIds: (ids) => api.users.getByIds(ids.map(Number)),
    getIdFromItem: (u) => String(u.id),
    resolveInstant: user
      ? (id) => String(user.id) === id ? asSelectableUser(user) : null
      : undefined,
  })
```

The hook reads IDs from URL on mount, resolves any it can instantly (e.g. the current user already in auth context), fetches the rest from `GET /users/by-ids?ids=…`, and returns a ready-made `syncedFilter` to pass to DataTable. The wrapper gates its data-fetch `useEffect` on `!isHydrating` to avoid a first render with incorrect (empty) filter state.

`hadInitialIds` is `true` when the URL contained IDs on mount. Wrappers use this to decide whether to apply component-level defaults — e.g. TrainingTable defaults to the current user only when `!hadInitialIds`, so a shared URL with explicit IDs is always honoured.

Bulk-fetch endpoints exist for all entity types that appear in URL filters:

- `GET /users/by-ids?ids=1,2,3` → `SelectableUser[]`
- `GET /schedules/by-ids?ids=1,2,3` → `SelectableSchedule[]`

## Default filter views

Opinionated defaults for a list page belong in the navigation link, not in the component. The sidebar "Training" link encodes the default status and user filters as URL search params; the `TrainingTable` component itself is filter-neutral and shows whatever the URL says (or everything, if the URL is empty).

## Considered options

**Opt-in per callsite** was rejected in favour of automatic sync. A generic DataTable owning URL state is surprising, but opt-in leads to inconsistent behaviour across the app and requires every future callsite to remember to wire it up.

**Wrapper-owned sync** (each server-paginated wrapper manages its own URL params) was rejected because it splits sync logic across DataTable and the three server-paginated wrappers, with no single place to reason about what's in the URL.

**`externalUrlSuffixesToClear`** was an early workaround that let wrappers register URL keys for DataTable to clear. It was replaced by `syncedFilters`, which gives DataTable full ownership of those keys rather than just clearing them.

## Consequences

- Routes that host a DataTable need a permissive `validateSearch: (s) => s as Record<string, string | undefined>` so TanStack Router doesn't strip unknown params.
- Pages with two DataTables (currently only SchedulePage) must pass an explicit `tableId` to each wrapper to avoid namespace collision.
- Selection-mode DataTables (TrainingNewPage, ScheduleNewPage) opt out via `tableId={false}` — they are pickers inside wizard flows, not persistent list views. `useUrlHydratedFilter` also respects `tableId={false}` and returns empty state immediately.
- Wrappers with `useUrlHydratedFilter` must add `isHydrating` to their data-fetch `useEffect` dependency array and return early while `true`.
