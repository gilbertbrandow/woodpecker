import * as React from "react";
import { useState, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Trash2, PencilLine, Lock } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { type ColumnDef } from "@tanstack/react-table";
import { UserAvatar } from "../UserAvatar";
import { StatusBadge } from "../StatusBadge";
import { useAuth } from "../../context/auth";
import { ServerDataTable } from "../ServerDataTable";
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
import type { ScheduleSummary } from "../../lib/api";
import { api } from "../../lib/api";
import { useUserFilterSpec } from "../../hooks/useUserFilterSpec";
import { formatDuration } from "./DurationInput";
import { toast } from "../../lib/toast";
import { ConceptIcon } from "../ConceptIcon";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { label: "Draft",  value: "draft",  icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" /> },
  { label: "Locked", value: "locked", icon: <Lock className="h-3.5 w-3.5 text-violet-600" /> },
]

type SchedulesTableProps = {
  subsetId?: number;
  onCountChange?: (count: number) => void;
  tableId?: string;
};

export function SchedulesTable({
  subsetId,
  onCountChange,
  tableId,
}: SchedulesTableProps): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userFilterSpec = useUserFilterSpec('userIds');

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const deletingIdRef = useRef(deletingId);
  deletingIdRef.current = deletingId;

  const handleDelete = async (item: ScheduleSummary): Promise<void> => {
    setDeletingId(item.id);
    try {
      await api.schedules.delete(item.id);
      toast.success("Schedule deleted", { description: `"${item.name}" has been removed.` });
      setRefreshKey((k) => k + 1);
    } finally {
      setDeletingId(null);
    }
  };
  const handleDeleteRef = useRef(handleDelete);
  handleDeleteRef.current = handleDelete;

  const columns = React.useMemo<ColumnDef<ScheduleSummary>[]>(
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
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "subset",
        accessorFn: (row) => row.subsetName,
        header: () => <span className="flex items-center gap-1.5"><ConceptIcon concept="Subset" className="h-3.5 w-3.5 text-muted-foreground" />Subset</span>,
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
        header: () => <span className="flex items-center gap-1.5"><ConceptIcon concept="Run" className="h-3.5 w-3.5 text-muted-foreground" />Runs</span>,
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
            {row.original.totalHours > 0 ? formatDuration(row.original.totalHours) : "—"}
          </span>
        ),
      },
      {
        id: "date",
        accessorFn: (row) =>
          row.lockedAt ? new Date(row.lockedAt).getTime() : new Date(row.createdAt).getTime(),
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
                    &ldquo;{row.original.name}&rdquo; will be permanently removed. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDeleteRef.current(row.original)}>
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
    <ServerDataTable
      tableId={tableId}
      columns={columns}
      pageSize={PAGE_SIZE}
      refreshKey={refreshKey}
      filters={[
        userFilterSpec,
        { type: 'multi', key: 'statuses', label: 'statuses', options: STATUS_OPTIONS },
        { type: 'search', key: 'q', placeholder: 'Search schedules…' },
      ]}
      fetchData={({ filters, page }) =>
        api.schedules.list({
          subsetId,
          search: filters.q?.[0] || undefined,
          page,
          pageSize: PAGE_SIZE,
          userIds: filters.userIds?.map(Number),
          statuses: filters.statuses?.length ? filters.statuses : undefined,
        })
      }
      onDataChange={(_, total) => onCountChange?.(total)}
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
