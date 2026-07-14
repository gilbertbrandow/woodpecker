import * as React from "react";
import { useState, useRef } from "react";
import { useServerTable } from "../../hooks/useServerTable";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Trash2, PencilLine, Lock, Activity } from "lucide-react";
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
import { CONCEPT_ICONS, DATA_ICONS } from "../../lib/icons";

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
  const userFilterSpec = useUserFilterSpec('userId', 'Creator');

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { refreshKey, refetch } = useServerTable();

  const deletingIdRef = useRef(deletingId);
  deletingIdRef.current = deletingId;

  const blockNavRef = useRef(false);

  const handleDelete = async (item: ScheduleSummary): Promise<void> => {
    setDeletingId(item.id);
    blockNavRef.current = true;
    try {
      await api.schedules.delete(item.id);
      toast.success("Schedule deleted", { description: `"${item.name}" has been removed.` });
      refetch();
    } finally {
      setDeletingId(null);
      setTimeout(() => { blockNavRef.current = false; }, 300);
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
        meta: { icon: DATA_ICONS.user },
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
        meta: { icon: DATA_ICONS.name },
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "subset",
        accessorFn: (row) => row.subsetName,
        header: "Subset",
        meta: { icon: CONCEPT_ICONS.Subset },
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
        meta: { icon: DATA_ICONS.status },
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "runCount",
        header: "Runs",
        meta: { icon: CONCEPT_ICONS.Run },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.runCount > 0 ? row.original.runCount : "—"}
          </span>
        ),
      },
      {
        accessorKey: "totalHours",
        header: "Duration",
        meta: { icon: DATA_ICONS.time },
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
        meta: { icon: DATA_ICONS.started },
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
          const canDelete = row.original.createdBy.id === user?.id && row.original.status !== 'locked';
          if (!canDelete) return null;
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
        { type: 'multi', key: 'status', label: 'Status', options: STATUS_OPTIONS, icon: Activity },
        { type: 'search', key: 'q' },
      ]}
      fetchData={(params) =>
        api.schedules.list(params, subsetId !== undefined ? { subsetId } : undefined)
      }
      onDataChange={(_, total) => onCountChange?.(total)}
      onRowClick={(schedule) => {
        if (blockNavRef.current) return;
        void navigate({
          to: "/app/schedules/$scheduleId",
          params: { scheduleId: String(schedule.id) },
        });
      }}
      emptyMessage="No schedules match your filters."
    />
  );
}
