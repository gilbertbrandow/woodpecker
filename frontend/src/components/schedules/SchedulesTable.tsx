import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Search, Trash2, PencilLine, Lock } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { UserAvatar } from "../UserAvatar";
import { StatusBadge } from "../StatusBadge";
import { DataTable } from "../DataTable";
import { UserSelector } from "../UserSelector";
import { Input } from "../ui/input";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../ui/alert-dialog";
import { useAuth } from "../../context/auth";
import type { ScheduleSummary } from "../../lib/api";
import { api } from "../../lib/api";
import { formatDuration } from "./DurationInput";
import { useDebounce } from "../../hooks/useDebounce";
import { toast } from "../../lib/toast";
import { useTableUrlSync } from "../../hooks/useTableUrlSync";
import { useUrlHydratedFilter } from "../../hooks/useUrlHydratedFilter";

const PAGE_SIZE = 20;

type SchedulesTableProps = {
  subsetId?: number;
  onCountChange?: (count: number) => void;
  tableId?: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SchedulesTable({
  subsetId,
  onCountChange,
  tableId,
}: SchedulesTableProps): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getParam, getMultiParam, setParams } = useTableUrlSync(tableId);

  const {
    value: selectedUsers,
    setValue: setSelectedUsers,
    isHydrating: usersHydrating,
    syncedFilter: userSyncedFilter,
  } = useUrlHydratedFilter({
    urlKey: 'userIds',
    tableId,
    fetchByIds: (ids) => api.users.getByIds(ids.map(Number)),
    getIdFromItem: (u) => String(u.id),
    resolveInstant: user ? (id) => String(user.id) === id
      ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
      : null : undefined,
  });

  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    const p = getParam("page");
    return p ? Math.max(1, parseInt(p, 10)) : 1;
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState(() => getParam("q") ?? "");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    getMultiParam("statuses"),
  );

  const debouncedSearch = useDebounce(search, 300);

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
    api.schedules
      .list({
        subsetId,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        userIds:
          selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      })
      .then((r) => {
        setSchedules(r.items);
        setTotal(r.total);
        onCountChange?.(r.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [
    user,
    usersHydrating,
    subsetId,
    debouncedSearch,
    page,
    selectedUsers,
    selectedStatuses,
    onCountChange,
    refreshKey,
  ]);

  const statusFilterColumn = {
    id: "statuses",
    label: "statuses",
    options: [
      {
        label: "Draft",
        value: "draft",
        icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" />,
      },
      {
        label: "Locked",
        value: "locked",
        icon: <Lock className="h-3.5 w-3.5 text-violet-600" />,
      },
    ],
  };

  const deletingIdRef = useRef(deletingId);
  deletingIdRef.current = deletingId;

  const handleDelete = async (item: ScheduleSummary): Promise<void> => {
    setDeletingId(item.id);
    try {
      await api.schedules.delete(item.id);
      toast.success("Schedule deleted", {
        description: `"${item.name}" has been removed.`,
      });
      setRefreshKey((k) => k + 1);
    } finally {
      setDeletingId(null);
    }
  };
  const handleDeleteRef = useRef(handleDelete);
  handleDeleteRef.current = handleDelete;

  const columns = useMemo<ColumnDef<ScheduleSummary>[]>(
    () => [
      {
        id: "creator",
        accessorFn: (row) => row.createdBy.displayName,
        header: "Creator",
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.createdBy.displayName}
            avatarUrl={row.original.createdBy.avatarUrl}
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "subset",
        accessorFn: (row) => row.subsetName,
        header: "Subset",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to="/app/subsets/$subsetId"
            params={{ subsetId: String(row.original.subsetId) }}
            className="text-sm text-muted-foreground hover:underline"
            title={row.original.subsetName}
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.subsetName}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "runCount",
        header: "Runs",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.runCount > 0 ? row.original.runCount : "—"}
          </span>
        ),
      },
      {
        accessorKey: "totalHours",
        header: "Duration",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.totalHours > 0
              ? formatDuration(row.original.totalHours)
              : "—"}
          </span>
        ),
      },
      {
        id: "date",
        accessorFn: (row) =>
          row.lockedAt
            ? new Date(row.lockedAt).getTime()
            : new Date(row.createdAt).getTime(),
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.lockedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const isOwn = row.original.createdBy.id === user?.id;
          if (!isOwn) return null;
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deletingIdRef.current !== null}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  aria-label="Delete schedule"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingIdRef.current === row.original.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{row.original.name}&rdquo; will be permanently
                    removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void handleDeleteRef.current(row.original)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
      },
    ],
    [user],
  );

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={schedules}
      loading={loading}
      hideSearch
      filtersSlot={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search schedules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm sm:w-56"
            />
          </div>
          <UserSelector
            value={selectedUsers}
            onChange={(users) => { setSelectedUsers(users); setPage(1); }}
          />
        </>
      }
      filterableColumns={[statusFilterColumn]}
      onFilterChange={(id, values) => {
        if (id === "statuses") {
          setSelectedStatuses(values);
          setPage(1);
        }
      }}
      syncedFilters={[userSyncedFilter]}
      filtersActive={search !== ""}
      onClearFilters={() => {
        setSearch("");
        setSelectedUsers([]);
        setPage(1);
      }}
      serverPagination={{
        totalRows: total,
        page,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
      }}
      pageSize={PAGE_SIZE}
      onRowClick={(schedule) =>
        void navigate({
          to: "/app/schedules/$scheduleId",
          params: { scheduleId: String(schedule.id) },
        })
      }
      emptyMessage="No schedules match your filters."
    />
  );
}
