# Controlled serverSorting prop on DataTable for server-side sort

When `ServerDataTable` is the wrapper, sort state is owned by `ServerDataTable` (not `DataTable` internally). `DataTable` gains an optional `serverSorting?: { sorting: SortingState; onSortingChange: (s: SortingState) => void }` controlled prop. When present, `DataTable` sets `manualSorting: true` (disabling client-side re-sort of already-sorted server data) and delegates state ownership to the caller. `ServerDataTable` initializes sort from the URL `?sort=colId:dir` param (falling back to `initialSorting`), includes it in `FetchParams`, and adds it as a fetch effect dependency.

## Considered options

**Callback only**: add `onSortingChange?: (s: SortingState) => void` to `DataTable`; `DataTable` keeps its own internal state and also fires the callback. Rejected because `DataTable` would still apply client-side sorting on top of already-sorted server data — the two sort operations would conflict unless `manualSorting` was also set, at which point `DataTable`'s internal state is a useless duplicate.

**URL-read by ServerDataTable**: `ServerDataTable` reads `?sort=` from the URL directly on each render. Rejected because the URL is written by `DataTable`'s `onSortingChange` handler asynchronously — `ServerDataTable` would race its own sibling and miss the first sort change.

**Controlled prop** (chosen): mirrors the exact pattern already established by `serverPagination`. Caller owns state, `DataTable` renders it. Consistent API surface, no duplicate state, no race.

## Consequences

- Existing direct `DataTable` usages (not through `ServerDataTable`) are unaffected — `serverSorting` is optional and client-side sort continues unchanged when absent.
- `ServerDataTable` initializes sorting from the URL on mount, so sort state survives page refresh and deep links work.
