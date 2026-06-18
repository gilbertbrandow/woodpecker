import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Timer,
  TrendingUp,
  CalendarClock,
  TrendingDown,
  Clock,
  Coffee,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { StatusBadge, trainingStateToStatusValue } from "../StatusBadge";
import { DataTable } from "../DataTable";
import { ProgressBar } from "../ProgressBar";
import { UserAvatar } from "../UserAvatar";
import { UserSelector } from "../UserSelector";
import {
  MultiSelectFilter,
  type MultiSelectOption,
} from "../ui/multi-select-filter";
import { Input } from "../ui/input";
import { useAuth } from "../../context/auth";
import {
  api,
  type AllTrainingSummary,
  type SelectableUser,
} from "../../lib/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useTableUrlSync } from "../../hooks/useTableUrlSync";
import { useUrlHydratedFilter } from "../../hooks/useUrlHydratedFilter";

const PAGE_SIZE = 20;

type TrainingTableProps = {
  scheduleId?: number;
  hideSchedule?: boolean;
  tableId?: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TrainingTable({
  scheduleId,
  hideSchedule = false,
  tableId,
}: TrainingTableProps): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getParam, getMultiParam, setParams } = useTableUrlSync(tableId);

  const [trainings, setTrainings] = useState<AllTrainingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    const p = getParam("page");
    return p ? Math.max(1, parseInt(p, 10)) : 1;
  });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(() => getParam("q") ?? "");
  const debouncedSearch = useDebounce(searchInput, 300);

  const {
    value: selectedUsers,
    setValue: setSelectedUsers,
    isHydrating: usersHydrating,
    hadInitialIds: hadUrlUserIds,
    syncedFilter: userSyncedFilter,
  } = useUrlHydratedFilter<SelectableUser>({
    urlKey: 'userId',
    tableId,
    fetchByIds: (ids) => api.users.getByIds(ids.map(Number)),
    getIdFromItem: (u) => String(u.id),
    resolveInstant: user ? (id) => String(user.id) === id
      ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
      : null : undefined,
  });

  // When URL had no userId, default to the current user so the table isn't overwhelming on
  // first load. DataTable's syncedFilters effect will write this to the URL.
  const defaultUserAppliedRef = useRef(false);
  useEffect(() => {
    if (!user || defaultUserAppliedRef.current || hadUrlUserIds) return;
    defaultUserAppliedRef.current = true;
    if (user.status === "active") {
      setSelectedUsers([{ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const statusOptions = useMemo<MultiSelectOption[]>(
    () => [
      {
        value: "not_started",
        label: "Not started",
        icon: <Timer className="h-3.5 w-3.5 text-gray-400" />,
      },
      {
        value: "active_run_on_track",
        label: "On schedule",
        icon: <CalendarClock className="h-3.5 w-3.5 text-blue-600" />,
      },
      {
        value: "active_run_ahead",
        label: "Ahead",
        icon: <TrendingUp className="h-3.5 w-3.5 text-green-600" />,
      },
      {
        value: "active_run_behind",
        label: "Behind",
        icon: <TrendingDown className="h-3.5 w-3.5 text-yellow-600" />,
      },
      {
        value: "active_run_overdue",
        label: "Run overdue",
        icon: <Clock className="h-3.5 w-3.5 text-red-600" />,
      },
      {
        value: "scheduled_break",
        label: "On break",
        icon: <Coffee className="h-3.5 w-3.5 text-green-600" />,
      },
      {
        value: "overdue_to_start_next_run",
        label: "Break overdue",
        icon: <Clock className="h-3.5 w-3.5 text-orange-500" />,
      },
      {
        value: "completed",
        label: "Completed",
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
      },
      {
        value: "aborted",
        label: "Aborted",
        icon: <XCircle className="h-3.5 w-3.5 text-red-600" />,
      },
    ],
    [],
  );

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    getMultiParam("status"),
  );

  const userIds = useMemo(
    () => selectedUsers.map((u) => u.id),
    [selectedUsers],
  );

  // Sync debounced search to URL; skip first render to preserve URL-restored page
  const searchMountedRef = useRef(false);
  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }
    setPage(1);
    setParams({ q: debouncedSearch || null, page: null });
  }, [debouncedSearch, setParams]);

  useEffect(() => {
    if (!user || usersHydrating) return;
    setLoading(true);
    api.training
      .listAll({
        scheduleId,
        userIds: userIds.length > 0 ? userIds : undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then(({ items, total: t }) => {
        setTrainings(items);
        setTotal(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scheduleId, usersHydrating, userIds, selectedStatuses, debouncedSearch, page, user]);

  const handleSearchChange = (value: string): void => {
    setSearchInput(value);
  };

  const handleUsersChange = useCallback((users: SelectableUser[]) => {
    setSelectedUsers(users);
    setPage(1);
  }, []);

  const handleStatusesChange = useCallback((statuses: string[]) => {
    setSelectedStatuses(statuses);
    setPage(1);
  }, []);

  const filtersActive = searchInput !== "";

  const handleClearFilters = useCallback(() => {
    // Reset to empty — URL params already cleared by DataTable before this runs.
    // filtersActive becomes false so the Clear button disappears.
    setSearchInput("");
    setSelectedUsers([]);
    setSelectedStatuses([]);
    setPage(1);
  }, []);

  const columns: ColumnDef<AllTrainingSummary>[] = useMemo(
    () => [
      {
        id: "user",
        accessorFn: (row) => row.user.displayName,
        header: "User",
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.user.displayName}
            avatarUrl={row.original.user.avatarUrl}
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <StatusBadge
            status={trainingStateToStatusValue(
              row.original.trainingState?.state ?? row.original.status,
            )}
          />
        ),
      },
      {
        id: "progress",
        accessorFn: (row) =>
          row.totalPuzzles > 0 ? row.completedPuzzles / row.totalPuzzles : 0,
        header: "Progress",
        cell: ({ row }) => {
          const pct =
            row.original.totalPuzzles > 0
              ? Math.round(
                  (row.original.completedPuzzles / row.original.totalPuzzles) *
                    100,
                )
              : 0;
          return (
            <ProgressBar
              value={pct}
              tooltipLabel={`${row.original.completedPuzzles}/${row.original.totalPuzzles} puzzles`}
              className="w-28"
            />
          );
        },
      },
      ...(!hideSchedule
        ? ([
            {
              id: "schedule",
              accessorFn: (row: AllTrainingSummary) => row.scheduleName,
              header: "Schedule",
              cell: ({ row }: { row: { original: AllTrainingSummary } }) => (
                <Link
                  to="/app/schedules/$scheduleId"
                  params={{ scheduleId: String(row.original.scheduleId) }}
                  className="font-medium hover:underline"
                  title={row.original.scheduleName}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.original.scheduleName}
                </Link>
              ),
            },
          ] as ColumnDef<AllTrainingSummary>[])
        : []),
      {
        id: "startedAt",
        accessorFn: (row) => new Date(row.startedAt).getTime(),
        header: "Started",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.startedAt)}
          </span>
        ),
      },
      {
        id: "completedAt",
        accessorFn: (row) =>
          row.completedAt ? new Date(row.completedAt).getTime() : 0,
        header: "Finished",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.completedAt
              ? formatDate(row.original.completedAt)
              : "—"}
          </span>
        ),
      },
    ],
    [hideSchedule],
  );

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={trainings}
      hideSearch={true}
      loading={loading}
      filtersSlot={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by schedule…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 pl-7 text-sm sm:w-56"
            />
          </div>
          <UserSelector value={selectedUsers} onChange={handleUsersChange} />
          <MultiSelectFilter
            label="statuses"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={handleStatusesChange}
          />
        </>
      }
      syncedFilters={[
        userSyncedFilter,
        { key: 'status', value: selectedStatuses, onChange: setSelectedStatuses },
      ]}
      filtersActive={filtersActive}
      onClearFilters={handleClearFilters}
      serverPagination={{
        totalRows: total,
        page,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
      }}
      pageSize={PAGE_SIZE}
      onRowClick={(t) =>
        void navigate({
          to: "/app/training/$trainingId",
          params: { trainingId: String(t.id) },
        })
      }
      emptyMessage="No training sessions match your filters."
    />
  );
}
