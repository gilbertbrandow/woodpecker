import * as React from "react";
import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/auth";
import {
  api,
  type Schedule,
  type ScheduleConfig,
  type ScheduleRunDef,
  type PuzzleOrder,
  type Subset,
  type ScheduleInsightPoint,
  type MyScheduleTraining,
  type AllTrainingSummary,
} from "../lib/api";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "../components/ui/chart";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { UserAvatar } from "../components/UserAvatar";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import { TrainingTable } from "../components/participations/TrainingTable";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "../components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  DurationInput,
  formatDuration,
} from "../components/schedules/DurationInput";
import { formatNumber } from "../lib/utils";

const MAX_RUNS = 20;


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const INSIGHTS_CONFIG: ChartConfig = {
  puzzlesPerDay: { label: "Puzzles / day", color: "hsl(var(--chart-1))" },
};

function formatTickDate(v: string): string {
  const d = new Date(v + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildConfig(
  runs: ScheduleRunDef[],
  puzzleOrder: PuzzleOrder,
  failedMode: "none" | "queue",
  maxRepeats: number,
): ScheduleConfig {
  return {
    runs,
    puzzle_order: puzzleOrder,
    failed_repetition:
      failedMode === "queue"
        ? { mode: "queue", max_repeats: maxRepeats }
        : { mode: "none" },
  };
}


function SectionTrigger({
  title,
  description,
  open,
  ...rest
}: {
  title: string;
  description: string;
  open: boolean;
} & React.ComponentPropsWithoutRef<"button">): React.ReactElement {
  return (
    <button
      type="button"
      className="flex h-8 w-full items-center justify-between border-b text-left"
      {...rest}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
        {title}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:block">
        {description}
      </span>
    </button>
  );
}

export function SchedulePage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { scheduleId } = useParams({ from: "/app/app-shell/schedules/$scheduleId" });
  const id = parseInt(scheduleId, 10);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [subset, setSubset] = useState<Subset | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [runs, setRuns] = useState<ScheduleRunDef[]>([]);
  const [puzzleOrder, setPuzzleOrder] = useState<PuzzleOrder>("random");
  const [failedMode, setFailedMode] = useState<"none" | "queue">("none");
  const [maxRepeats, setMaxRepeats] = useState(2);
  const [isDirty, setIsDirty] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [runsOpen, setRunsOpen] = useState(true);
  const [orderOpen, setOrderOpen] = useState(true);
  const [repetitionOpen, setRepetitionOpen] = useState(true);

  const [myTraining, setMyTraining] = useState<MyScheduleTraining | null | undefined>(undefined)
  const [enrolling, setEnrolling] = useState(false)
  const [scheduleTrainings, setScheduleTrainings] = useState<AllTrainingSummary[] | null>(null)

  const [activeTab, setActiveTab] = useState("configuration");
  const [insightsData, setInsightsData] = useState<ScheduleInsightPoint[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [usedByOpen, setUsedByOpen] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.schedules
      .get(id)
      .then((s) => {
        setSchedule(s);
        if (s.config) {
          setRuns(s.config.runs);
          setPuzzleOrder(s.config.puzzle_order);
          setFailedMode(s.config.failed_repetition.mode);
          setMaxRepeats(s.config.failed_repetition.max_repeats ?? 2);
        }
        setIsDirty(false);
        if (s.status === "locked") {
          setRunsOpen(false);
          setOrderOpen(false);
          setRepetitionOpen(false);
          setActiveTab("insights");
          api.schedules
            .getMyTraining(s.id)
            .then((p) => setMyTraining(p))
            .catch(() => setMyTraining(null));
        }
        return api.subsets.get(s.subsetId);
      })
      .then((sub) => setSubset(sub))
      .catch(() =>
        toast.error("Failed to load schedule", {
          description: "Could not fetch schedule data.",
        }),
      )
      .finally(() => setPageLoading(false));
  }, [id, user]);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    if (activeTab !== "insights" || scheduleTrainings !== null || !user) return;
    api.training
      .listAll(id)
      .then(setScheduleTrainings)
      .catch(() => {});
  }, [activeTab, id, user, scheduleTrainings]);

  useEffect(() => {
    if (activeTab !== "insights" || insightsData !== null || !user) return;
    setInsightsLoading(true);
    api.schedules
      .insights(id)
      .then((data) => setInsightsData(data))
      .catch(() =>
        toast.error("Failed to load insights", {
          description: "Could not fetch chart data.",
        }),
      )
      .finally(() => setInsightsLoading(false));
  }, [activeTab, id, user, insightsData]);

  if (authLoading || !user) return null;

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Schedule not found.</p>
      </div>
    );
  }

  const locked = schedule.status === "locked";
  const isOwn = schedule.createdBy.username === user.username;
  const showActions = isOwn && !locked;

  const totalHours = runs.reduce(
    (sum, r) => sum + r.target_hours + r.break_after_hours,
    0,
  );
  const canLock = runs.length > 0;

  const puzzleCount = subset?.puzzleCount ?? 0;
  const runDays = runs.map((r) => Math.max(1, Math.round(r.target_hours / 24)));
  const totalActiveDays = runDays.reduce((s, d) => s + d, 0);
  const totalAttempts = puzzleCount * runs.length;
  const peakPuzzlesPerDay =
    puzzleCount > 0 && runDays.length > 0
      ? Math.round(puzzleCount / Math.min(...runDays))
      : 0;

  const markDirty = (): void => setIsDirty(true);

  const handleEnroll = async (): Promise<void> => {
    setEnrolling(true);
    try {
      const participation = await api.training.create(id);
      void navigate({
        to: "/app/training/$trainingId",
        params: { trainingId: String(participation.id) },
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("409")) {
        const p = await api.schedules.getMyTraining(id);
        setMyTraining(p);
      } else {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast.error("Enroll failed", { description: msg });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await api.schedules.delete(id);
      toast("Schedule deleted", {
        description: "The schedule has been removed.",
      });
      void navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Delete failed", { description: msg });
    }
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const config = buildConfig(runs, puzzleOrder, failedMode, maxRepeats);
      const updated = await api.schedules.update(id, { config });
      setSchedule(updated);
      setIsDirty(false);
      toast("Configuration saved", {
        description: "Your settings have been saved.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Save failed", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLock = async (): Promise<void> => {
    try {
      if (isDirty) {
        setIsSaving(true);
        const config = buildConfig(runs, puzzleOrder, failedMode, maxRepeats);
        await api.schedules.update(id, { config });
        setIsDirty(false);
        setIsSaving(false);
      }
      const updated = await api.schedules.lock(id);
      setSchedule(updated);
      setRunsOpen(false);
      setOrderOpen(false);
      setRepetitionOpen(false);
      toast("Schedule locked", {
        description: "This schedule is now ready for use.",
      });
    } catch (err) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Lock failed", { description: msg });
    }
  };

  const updateRun = (
    index: number,
    field: keyof ScheduleRunDef,
    hours: number,
  ): void => {
    setRuns((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: hours } : r)),
    );
    markDirty();
  };

  const addRun = (): void => {
    setRuns((prev) => [...prev, { target_hours: 168, break_after_hours: 0 }]);
    markDirty();
  };

  const removeRun = (index: number): void => {
    setRuns((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Schedules</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{schedule.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold">{schedule.name}</h1>
            <Badge variant="outline" className="capitalize text-xs">
              {schedule.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDuration(schedule.totalHours)}
            </span>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isSaving}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{schedule.name}" will be permanently removed. This cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDelete()}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving…" : "Save configuration"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={!canLock || isSaving}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Lock in
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Lock this schedule?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Locking is permanent. The schedule configuration cannot be
                    changed after this.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleLock()}>
                    Lock
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {subset && (
        <div className="mb-6 rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subset
            </span>
          </div>
          <div
            className="flex cursor-pointer items-center gap-4 overflow-x-auto px-4 py-3 transition-colors hover:bg-muted/50"
            onClick={() =>
              void navigate({
                to: "/app/subsets/$subsetId",
                params: { subsetId: String(subset.id) },
              })
            }
          >
            <UserAvatar username={subset.ownedBy.username} avatarUrl={subset.ownedBy.avatarUrl} className="shrink-0" />
            <span className="flex-1 shrink-0 whitespace-nowrap font-medium">{subset.name}</span>
            <StatusBadge status={subset.status} />
            <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
              {subset.puzzleCount} puzzles
            </span>
            {subset.lockedAt && (
              <span className="hidden shrink-0 whitespace-nowrap text-sm text-muted-foreground sm:block">
                {new Date(subset.lockedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {locked && (
        <div className="mb-6 rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              My Training
            </span>
          </div>

          {myTraining === undefined ? (
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : myTraining === null ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <p className="flex-1 text-sm text-muted-foreground">
                You are not training this schedule.
              </p>
              <Button size="sm" onClick={() => void handleEnroll()} disabled={enrolling}>
                {enrolling ? "Starting…" : "Start training"}
              </Button>
            </div>
          ) : (
            <div
              className="flex cursor-pointer items-center gap-6 overflow-x-auto px-4 py-3 transition-colors hover:bg-muted/50"
              onClick={() =>
                void navigate({
                  to: "/app/training/$trainingId",
                  params: { trainingId: String(myTraining.id) },
                })
              }
            >
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} className="h-7 w-7 shrink-0" />
              <ProgressBar value={65} tooltipLabel="3/5 Runs, 67% completed" className="w-40 shrink-0" />
              <div className="flex-1 shrink-0" />
              <StatusBadge status={myTraining.status} />
              <span className="hidden shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:block">
                {formatDate(myTraining.startedAt)}
              </span>
            </div>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
        <TabsList className="mb-6">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          {locked && (
            <div className="mb-6 flex items-center gap-2 rounded-md border px-4 py-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              This schedule is locked. Configuration cannot be changed.
            </div>
          )}

          <div className="flex flex-col gap-4">
        <Collapsible open={runsOpen} onOpenChange={setRunsOpen}>
          <CollapsibleTrigger asChild>
            <SectionTrigger
              title="Runs"
              description="Each run is one complete pass through all puzzles."
              open={runsOpen}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-4">
              <div className="flex flex-col gap-5">
                  {runs.map((run, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2.5"
                    >
                      <span className="flex-1 text-sm font-medium">
                        Run {i + 1}
                      </span>
                      <div className="flex flex-1 items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Duration
                        </span>
                        <DurationInput
                          value={run.target_hours}
                          onChange={(h) => updateRun(i, "target_hours", h)}
                          disabled={locked || isSaving}
                        />
                      </div>
                      <div className="flex flex-1 items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Break
                        </span>
                        <DurationInput
                          value={run.break_after_hours}
                          onChange={(h) => updateRun(i, "break_after_hours", h)}
                          disabled={locked || isSaving || i === runs.length - 1}
                          allowZero
                        />
                      </div>
                      <div className="w-7">
                        {!locked && runs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRun(i)}
                            disabled={isSaving}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                            aria-label="Remove run"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!locked && runs.length < MAX_RUNS && (
                    <button
                      type="button"
                      onClick={addRun}
                      disabled={isSaving}
                      className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add run
                    </button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Total: {formatDuration(totalHours)}
                  </p>
                </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={orderOpen} onOpenChange={setOrderOpen}>
          <CollapsibleTrigger asChild>
            <SectionTrigger
              title="Puzzle order"
              description="Controls the order puzzles are presented within each run."
              open={orderOpen}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="py-6">
              <RadioGroup
                value={puzzleOrder}
                onValueChange={(v) => {
                  setPuzzleOrder(v as PuzzleOrder);
                  markDirty();
                }}
                disabled={locked || isSaving}
                className="gap-4"
              >
                {(
                  [
                    {
                      value: "random",
                      label: "Random",
                      description:
                        "Shuffled independently at the start of each run.",
                    },
                    {
                      value: "fixed",
                      label: "Fixed",
                      description:
                        "Follows the subset's curation order. Identical across runs.",
                    },
                    {
                      value: "rating_asc",
                      label: "Rating ↑",
                      description: "Easiest first. Identical across runs.",
                    },
                    {
                      value: "rating_desc",
                      label: "Rating ↓",
                      description: "Hardest first. Identical across runs.",
                    },
                  ] as const
                ).map((opt) => (
                  <div key={opt.value} className="flex items-start gap-3">
                    <RadioGroupItem
                      value={opt.value}
                      id={`order-${opt.value}`}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`order-${opt.value}`}
                      className="flex flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={repetitionOpen} onOpenChange={setRepetitionOpen}>
          <CollapsibleTrigger asChild>
            <SectionTrigger
              title="Failed puzzles"
              description="What happens when you fail a puzzle within a run."
              open={repetitionOpen}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="py-6">
              <RadioGroup
                value={failedMode}
                onValueChange={(v) => {
                  setFailedMode(v as "none" | "queue");
                  markDirty();
                }}
                disabled={locked || isSaving}
                className="gap-4"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="none"
                    id="failed-none"
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="failed-none"
                    className="flex flex-col gap-0.5 cursor-pointer"
                  >
                    <span className="text-sm font-medium">No repetition</span>
                    <span className="text-xs text-muted-foreground">
                      Failure is recorded. Puzzle is not repeated in this run.
                    </span>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="queue"
                    id="failed-queue"
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="failed-queue"
                    className="flex flex-col gap-0.5 cursor-pointer"
                  >
                    <span className="text-sm font-medium">Re-queue</span>
                    <span className="text-xs text-muted-foreground">
                      Failed puzzle is appended to the end of the remaining
                      queue.
                    </span>
                  </label>
                </div>
              </RadioGroup>

              {failedMode === "queue" && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Repeat up to
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={maxRepeats}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) {
                        setMaxRepeats(Math.min(5, Math.max(1, v)));
                        markDirty();
                      }
                    }}
                    disabled={locked || isSaving}
                    className="h-8 w-16 text-sm tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">time(s)</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <div className="flex flex-col gap-4">
            <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b pb-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{
                        transform: statsOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    />
                    Stats
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Daily puzzle targets over the schedule timeline
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-4 pt-4">
                  {runs.length > 0 && puzzleCount > 0 && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="flex flex-col gap-0.5 rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total attempts</p>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(totalAttempts)}</p>
                      </div>
                      <div className="flex flex-col gap-0.5 rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total duration</p>
                        <p className="text-lg font-semibold tabular-nums">{formatDuration(totalHours)}</p>
                      </div>
                      <div className="flex flex-col gap-0.5 rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Active days</p>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(totalActiveDays)} days</p>
                      </div>
                      <div className="flex flex-col gap-0.5 rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Peak daily demand</p>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(peakPuzzlesPerDay)} / day</p>
                      </div>
                    </div>
                  )}
                  {insightsLoading && (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  )}
                  {!insightsLoading &&
                    insightsData !== null &&
                    insightsData.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No data — configure at least one run with a duration
                        greater than zero.
                      </p>
                    )}
                  {!insightsLoading &&
                    insightsData !== null &&
                    insightsData.length > 0 && (
                      <div className="rounded-md border p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold">
                            Daily puzzle targets
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Average puzzles to complete each day to finish each
                            run on time
                          </p>
                        </div>
                        {chartsReady && (
                          <ChartContainer
                            config={INSIGHTS_CONFIG}
                            className="h-64 min-w-0 w-full"
                          >
                            <AreaChart
                              data={insightsData}
                              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient
                                  id="insightsGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="var(--color-puzzlesPerDay)"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="var(--color-puzzlesPerDay)"
                                    stopOpacity={0.1}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                interval={6}
                                tick={{ fontSize: 10 }}
                                tickFormatter={formatTickDate}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                                width={32}
                              />
                              <ChartTooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const point = payload[0]
                                    ?.payload as ScheduleInsightPoint;
                                  return (
                                    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                                      <p className="font-medium">
                                        {new Date(
                                          point.date + "T12:00:00",
                                        ).toLocaleDateString(undefined, {
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {point.puzzlesPerDay} puzzles / day
                                      </p>
                                    </div>
                                  );
                                }}
                              />
                              <Area
                                type="step"
                                dataKey="puzzlesPerDay"
                                stroke="var(--color-puzzlesPerDay)"
                                fill="url(#insightsGradient)"
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ChartContainer>
                        )}
                      </div>
                    )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={usedByOpen} onOpenChange={setUsedByOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b pb-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{
                        transform: usedByOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    />
                    Used by
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Users who trained with this schedule
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4">
                  {scheduleTrainings === null ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <TrainingTable trainings={scheduleTrainings} hideSchedule />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
