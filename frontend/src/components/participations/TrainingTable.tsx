import * as React from "react";
import { useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { formatDate } from "../../lib/utils";
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
} from "lucide-react";
import { StatusBadge, trainingStateToStatusValue } from "../StatusBadge";
import { ProgressBar } from "../ProgressBar";
import { UserAvatar } from "../UserAvatar";
import { ServerDataTable } from "../ServerDataTable";
import { api, type AllTrainingSummary } from "../../lib/api";
import { useUserFilterSpec } from "../../hooks/useUserFilterSpec";
import { CONCEPT_ICONS, DATA_ICONS } from "../../lib/icons";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "not_started",               label: "Not started",   icon: <Timer className="h-3.5 w-3.5 text-gray-400" /> },
  { value: "active_run_on_track",       label: "On schedule",   icon: <CalendarClock className="h-3.5 w-3.5 text-blue-600" /> },
  { value: "active_run_ahead",          label: "Ahead",         icon: <TrendingUp className="h-3.5 w-3.5 text-green-600" /> },
  { value: "active_run_behind",         label: "Behind",        icon: <TrendingDown className="h-3.5 w-3.5 text-yellow-600" /> },
  { value: "active_run_overdue",        label: "Run overdue",   icon: <Clock className="h-3.5 w-3.5 text-red-600" /> },
  { value: "scheduled_break",           label: "On break",      icon: <Coffee className="h-3.5 w-3.5 text-green-600" /> },
  { value: "overdue_to_start_next_run", label: "Break overdue", icon: <Clock className="h-3.5 w-3.5 text-orange-500" /> },
  { value: "completed",                 label: "Completed",     icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
  { value: "aborted",                   label: "Aborted",       icon: <XCircle className="h-3.5 w-3.5 text-red-600" /> },
]

type TrainingTableProps = {
  scheduleId?: number;
  hideSchedule?: boolean;
  tableId?: string;
};

export function TrainingTable({
  scheduleId,
  hideSchedule = false,
  tableId,
}: TrainingTableProps): React.ReactElement {
  const navigate = useNavigate();
  const userFilterSpec = useUserFilterSpec('userId');

  const columns = useMemo<ColumnDef<AllTrainingSummary>[]>(
    () => [
      {
        id: "user",
        accessorFn: (row) => row.user.displayName,
        header: "User",
        meta: { icon: DATA_ICONS.user },
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
        meta: { icon: DATA_ICONS.status },
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
        meta: { icon: DATA_ICONS.progress },
        cell: ({ row }) => {
          const pct =
            row.original.totalPuzzles > 0
              ? Math.round(
                  (row.original.completedPuzzles / row.original.totalPuzzles) * 100,
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
              meta: { icon: CONCEPT_ICONS.Schedule },
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
        meta: { icon: DATA_ICONS.started },
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
        meta: { icon: DATA_ICONS.finished },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.completedAt ? formatDate(row.original.completedAt) : "—"}
          </span>
        ),
      },
    ],
    [hideSchedule],
  );

  return (
    <ServerDataTable
      tableId={tableId}
      columns={columns}
      pageSize={PAGE_SIZE}
      instanceKey={scheduleId}
      filters={[
        userFilterSpec,
        { type: 'multi', key: 'status', label: 'statuses', options: STATUS_OPTIONS },
        { type: 'search', key: 'q' },
      ]}
      fetchData={({ filters, page }) =>
        api.training.listAll({
          scheduleId,
          userIds: filters.userId?.map(Number),
          statuses: filters.status?.length ? filters.status : undefined,
          search: filters.q?.[0] || undefined,
          page,
          pageSize: PAGE_SIZE,
        })
      }
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
