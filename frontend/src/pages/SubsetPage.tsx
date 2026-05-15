import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Lock, Trash2, Undo2 } from "lucide-react";
import { useAuth } from "../context/auth";
import {
  api,
  type Subset,
  type SubsetConfig,
  type SubsetStats as SubsetStatsType,
  type ScheduleSummary,
} from "../lib/api";
import { SchedulesTable } from "../components/schedules/SchedulesTable";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip";
import { StatusBadge } from "../components/StatusBadge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
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
  RatingChart,
  type RatingValue,
} from "../components/subsets/RatingChart";
import { ThemeWeights } from "../components/subsets/ThemeWeights";
import {
  OpeningSelector,
  type OpeningValue,
} from "../components/subsets/OpeningSelector";
import { SubsetStats } from "../components/subsets/SubsetStats";
import { PuzzleTable } from "../components/subsets/PuzzleTable";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../components/ui/collapsible";

const RATING_DEFAULT: RatingValue = {
  min: 1800,
  max: 2600,
  mean: 2200,
  sigma: 100,
};
const OPENING_DEFAULT: OpeningValue = { items: [], strength: 0 };
const MIN_LOCK_PUZZLES = 5;

function configToRating(config: SubsetConfig | null): RatingValue {
  const min = config?.rating?.min ?? RATING_DEFAULT.min;
  const max = config?.rating?.max ?? RATING_DEFAULT.max;
  return {
    min,
    max,
    mean: config?.rating?.mean ?? Math.round((min + max) / 2),
    sigma: config?.rating?.sigma ?? RATING_DEFAULT.sigma,
  };
}

function configToOpening(config: SubsetConfig | null): OpeningValue {
  return {
    items: config?.openings?.items ?? [],
    strength: config?.openings?.strength ?? 0,
  };
}

function buildConfig(
  rating: RatingValue,
  themes: Record<string, number>,
  opening: OpeningValue,
): SubsetConfig {
  const config: SubsetConfig = {
    rating: {
      min: rating.min,
      max: rating.max,
      ...(rating.mean !== null ? { mean: rating.mean } : {}),
      ...(rating.sigma !== null ? { sigma: rating.sigma } : {}),
    },
  };
  const nonDefaultThemes = Object.fromEntries(
    Object.entries(themes).filter(([, v]) => v !== 1),
  );
  if (Object.keys(nonDefaultThemes).length > 0) {
    config.themes = nonDefaultThemes;
  }
  if (opening.items.length > 0) {
    config.openings = { items: opening.items, strength: opening.strength };
  }
  return config;
}

function SectionTrigger({
  title,
  description,
  open,
  changed,
  onReset,
  ...rest
}: {
  title: string;
  description: string;
  open: boolean;
  changed: boolean;
  onReset?: () => void;
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
        {onReset && changed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground"
                  tabIndex={-1}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Reset section</TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:block">
        {description}
      </span>
    </button>
  );
}

function UsedBySchedules({
  subsetId,
  currentUserId,
}: {
  subsetId: number;
  currentUserId: number;
}): React.ReactElement {
  const [open, setOpen] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    api.schedules
      .list(subsetId)
      .then((data) => setSchedules(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subsetId]);

  const handleDelete = (schedule: ScheduleSummary): void => {
    setDeletingId(schedule.id);
    api.schedules
      .delete(schedule.id)
      .then(() =>
        setSchedules((prev) => prev.filter((s) => s.id !== schedule.id)),
      )
      .catch(() => {})
      .finally(() => setDeletingId(null));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between border-b pb-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            Used by{schedules.length > 0 ? ` (${schedules.length})` : ""}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            Schedules that use this subset
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No schedules use this subset yet.
            </p>
          ) : (
            <SchedulesTable
              schedules={schedules}
              currentUserId={currentUserId}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SubsetPage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { subsetId } = useParams({ from: "/app/app-shell/subsets/$subsetId" });
  const id = parseInt(subsetId, 10);

  const [subset, setSubset] = useState<Subset | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("configuration");

  const [rating, setRating] = useState<RatingValue>(RATING_DEFAULT);
  const [themes, setThemes] = useState<Record<string, number>>({});
  const [opening, setOpening] = useState<OpeningValue>(OPENING_DEFAULT);
  const [isDirty, setIsDirty] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SubsetStatsType | null>(null);
  const [puzzlesOpen, setPuzzlesOpen] = useState(true);
  const [ratingOpen, setRatingOpen] = useState(true);
  const [themesOpen, setThemesOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/" });
    }
  }, [user, authLoading, navigate]);

  const loadStats = useCallback(async (subsetIdArg: number): Promise<void> => {
    const s = await api.subsets.getStats(subsetIdArg);
    setStats(s);
    setTotal(s.totalActive);
  }, []);

  const handleTotalChange = useCallback(
    (n: number): void => {
      setTotal(n);
      void loadStats(id);
    },
    [id, loadStats],
  );

  useEffect(() => {
    if (!user) return;
    api.subsets
      .get(id)
      .then(async (s) => {
        setSubset(s);
        setRating(configToRating(s.config));
        setThemes(s.config?.themes ?? {});
        setOpening(configToOpening(s.config));
        setIsDirty(false);
        setActiveTab(s.status === "locked" ? "insights" : "configuration");
        if (s.status !== "draft") {
          await loadStats(id);
        }
        if (s.status === "locked") {
          setRatingOpen(false);
          setThemesOpen(false);
          setOpeningOpen(false);
        }
      })
      .catch(() =>
        toast.error("Failed to load subset", {
          description: "Could not fetch subset data.",
        }),
      )
      .finally(() => setPageLoading(false));
  }, [id, user, loadStats]);

  const markDirty = (): void => setIsDirty(true);

  const handleSave = async (): Promise<void> => {
    if (!subset) return;
    setIsSaving(true);
    try {
      const config = buildConfig(rating, themes, opening);
      const updated = await api.subsets.saveConfig(
        id,
        subset.puzzleCount,
        config,
      );
      setSubset(updated);
      setIsDirty(false);
      if (updated.status === "draft") {
        setStats(null);
        setTotal(0);
      }
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

  const handleFillOrRefill = async (): Promise<void> => {
    if (!subset) return;
    setIsFilling(true);
    try {
      if (isDirty) {
        const config = buildConfig(rating, themes, opening);
        const updated = await api.subsets.saveConfig(
          id,
          subset.puzzleCount,
          config,
        );
        setSubset(updated);
        setIsDirty(false);
        setStats(null);
        setTotal(0);
      }
      if (total === 0) {
        const result = await api.subsets.fill(id);
        const updated = await api.subsets.get(id);
        setSubset(updated);
        await loadStats(id);
        if (result.filled < result.requested) {
          toast("Fill complete", {
            description: `Filled ${result.filled} of ${result.requested} requested puzzles.`,
          });
        } else {
          toast("Fill complete", {
            description: `${result.filled} puzzles added.`,
          });
        }
      } else {
        const result = await api.subsets.refill(id);
        await loadStats(id);
        toast("Refill complete", {
          description:
            result.filled === 0
              ? "Subset is already full."
              : `Added ${result.filled} puzzle${result.filled === 1 ? "" : "s"}.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error(total === 0 ? "Fill failed" : "Refill failed", {
        description: msg,
      });
    } finally {
      setIsFilling(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await api.subsets.delete(id);
      toast("Subset deleted", { description: "The subset has been removed." });
      void navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Delete failed", { description: msg });
    }
  };

  const handleLock = async (): Promise<void> => {
    try {
      const updated = await api.subsets.lock(id);
      setSubset(updated);
      setRatingOpen(false);
      setThemesOpen(false);
      setOpeningOpen(false);
      toast("Subset locked", {
        description: "This subset is now frozen and ready for scheduling.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Lock failed", { description: msg });
    }
  };

  if (authLoading || !user) return null;

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!subset) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Subset not found.</p>
      </div>
    );
  }

  const locked = subset.status === "locked";
  const isOwn = subset.ownedBy.id === user.id;
  const isBusy = isSaving || isFilling;
  const puzzleCount = subset.puzzleCount;
  const isFull = total >= puzzleCount;
  const fillLabel = total === 0 ? "Fill" : "Refill";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Subsets</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{subset.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold">{subset.name}</h1>
        <StatusBadge status={subset.status} />
        <span className="text-sm text-muted-foreground">
          {subset.puzzleCount} puzzles
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flexflex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="mb-6">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {!locked && isOwn && (
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isBusy}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this subset?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{subset.name}" and all its puzzles will be permanently removed. This cannot be undone.
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
                onClick={() => void handleFillOrRefill()}
                disabled={isBusy || isFull}
              >
                {isFilling ? `${fillLabel}ing…` : fillLabel}
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          disabled={total < MIN_LOCK_PUZZLES || isBusy}
                        >
                          <Lock className="mr-1.5 h-3.5 w-3.5" />
                          Lock in
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Lock this subset?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Locking is permanent. The subset will be frozen with
                            its current {total} puzzle{total !== 1 ? "s" : ""}{" "}
                            and cannot be modified.
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
                  </span>
                </TooltipTrigger>
                {total < MIN_LOCK_PUZZLES && (
                  <TooltipContent>
                    Need at least {MIN_LOCK_PUZZLES} puzzles to lock
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
        </div>
        <TabsContent value="configuration">
          {!locked && isOwn && (
            <div className="flex flex-col gap-3 pb-5">
              <p className="rounded-md border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                Configuration is a set of preferences, not hard guarantees.
                Rating bounds are strict — everything else is weighted sampling.
                We always try to fill to your target count; if the eligible pool
                is smaller, you get however many puzzles match.
              </p>
            </div>
          )}

          {locked && (
            <div className="mb-4 flex items-center gap-2 rounded-md border px-4 py-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              This subset is locked. Configuration cannot be changed.
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Collapsible open={ratingOpen} onOpenChange={setRatingOpen}>
              <CollapsibleTrigger asChild>
                <SectionTrigger
                  title="Puzzle rating"
                  description="Range and concentration of puzzle ratings."
                  open={ratingOpen}
                  changed={
                    JSON.stringify(rating) !== JSON.stringify(RATING_DEFAULT)
                  }
                  onReset={
                    !locked && isOwn
                      ? () => {
                          setRating(RATING_DEFAULT);
                          markDirty();
                        }
                      : undefined
                  }
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4">
                  <RatingChart
                    value={rating}
                    onChange={(v) => {
                      setRating(v);
                      markDirty();
                    }}
                    disabled={locked || !isOwn || isBusy}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={themesOpen} onOpenChange={setThemesOpen}>
              <CollapsibleTrigger asChild>
                <SectionTrigger
                  title="Tactical themes"
                  description="Relative likelihood of each tactical motif."
                  open={themesOpen}
                  changed={Object.keys(themes).length > 0}
                  onReset={
                    !locked && isOwn
                      ? () => {
                          setThemes({});
                          markDirty();
                        }
                      : undefined
                  }
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4">
                  <ThemeWeights
                    value={themes}
                    onChange={(v) => {
                      setThemes(v);
                      markDirty();
                    }}
                    disabled={locked || !isOwn || isBusy}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={openingOpen} onOpenChange={setOpeningOpen}>
              <CollapsibleTrigger asChild>
                <SectionTrigger
                  title="Openings"
                  description="Favour puzzles from specific openings."
                  open={openingOpen}
                  changed={opening.items.length > 0}
                  onReset={
                    !locked && isOwn
                      ? () => {
                          setOpening(OPENING_DEFAULT);
                          markDirty();
                        }
                      : undefined
                  }
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4">
                  <OpeningSelector
                    value={opening}
                    onChange={(v) => {
                      setOpening(v);
                      markDirty();
                    }}
                    disabled={locked || !isOwn || isBusy}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {!locked && isOwn && (
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Button
                onClick={() => void handleSave()}
                disabled={!isDirty || isBusy}
                variant="outline"
              >
                {isSaving ? "Saving…" : "Save configuration"}
              </Button>
            </div>
          )}

          {total > 0 && (
            <div className="mt-6">
              <Collapsible open={puzzlesOpen} onOpenChange={setPuzzlesOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-b pb-2.5 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                        style={{
                          transform: puzzlesOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                      Puzzles{total > 0 ? ` (${total})` : ""}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      All puzzles currently in this subset
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-6">
                    <PuzzleTable
                      subsetId={id}
                      locked={locked}
                      onTotalChange={handleTotalChange}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights">
          <div className="flex flex-col gap-4">
            {stats ? (
              <SubsetStats stats={stats} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No data yet — fill the subset first.
              </p>
            )}
            <UsedBySchedules subsetId={id} currentUserId={user.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
