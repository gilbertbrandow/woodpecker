import { PageWrapper } from '../components/PageWrapper'
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "../lib/toast";
import { ChevronDown, Lock, Trash2 } from "lucide-react";
import { useAuth } from "../context/auth";
import {
  api,
  type Subset,
  type SubsetConfig,
  type SubsetStats as SubsetStatsType,
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
import { useSetBreadcrumbTitle } from "../hooks/useSetBreadcrumbTitle";
import { SubsetStats } from "../components/subsets/SubsetStats";
import { PuzzleTable } from "../components/subsets/PuzzleTable";
import {
  SourceCompositionEditor,
  DEFAULT_LICHESS_ENTRY,
} from "../components/subsets/SourceCompositionEditor";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../components/ui/collapsible";
import { ConceptIcon } from "../components/ConceptIcon";

const MIN_LOCK_PUZZLES = 5;

const DEFAULT_CONFIG: SubsetConfig = { sources: [DEFAULT_LICHESS_ENTRY] };

function configFromSubset(s: Subset): SubsetConfig {
  if (!s.config) return DEFAULT_CONFIG;
  return {
    sources: s.config.sources ?? [DEFAULT_LICHESS_ENTRY],
    subsetRefs: s.config.subsetRefs,
    excludeSubsets: s.config.excludeSubsets,
  };
}

function UsedBySchedules({ subsetId }: { subsetId: number }): React.ReactElement {
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState<number | null>(null);

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
            Used by{count !== null && count > 0 ? ` (${count})` : ""}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            Schedules that use this subset
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4">
          <SchedulesTable subsetId={subsetId} onCountChange={setCount} />
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

  const [config, setConfig] = useState<SubsetConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<SubsetConfig>(DEFAULT_CONFIG);
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const [isSaving, setIsSaving] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SubsetStatsType | null>(null);

  useSetBreadcrumbTitle(subset?.name);

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
        const initial = configFromSubset(s);
        setConfig(initial);
        setSavedConfig(initial);
        setActiveTab(s.status === "locked" ? "insights" : "configuration");
        if (s.status !== "draft") {
          await loadStats(id);
        }
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [id, user, loadStats]);

  const handleSave = async (): Promise<void> => {
    if (!subset) return;
    setIsSaving(true);
    try {
      const updated = await api.subsets.saveConfig(id, subset.puzzleCount, config);
      setSubset(updated);
      setSavedConfig(config);
      if (updated.status === "draft") {
        setStats(null);
        setTotal(0);
      }
      toast.success("Configuration saved", {
        description: "Your settings have been saved.",
      });
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const handleFillOrRefill = async (): Promise<void> => {
    if (!subset) return;
    setIsFilling(true);
    try {
      if (isDirty) {
        const updated = await api.subsets.saveConfig(id, subset.puzzleCount, config);
        setSubset(updated);
        setSavedConfig(config);
        setStats(null);
        setTotal(0);
      }
      if (total === 0) {
        const result = await api.subsets.fill(id);
        const updated = await api.subsets.get(id);
        setSubset(updated);
        await loadStats(id);
        if (result.filled < result.requested) {
          toast.success("Fill complete", {
            description: `Filled ${result.filled} of ${result.requested} requested puzzles.`,
          });
        } else {
          toast.success("Fill complete", {
            description: `${result.filled} puzzles added.`,
          });
        }
      } else {
        const result = await api.subsets.refill(id);
        await loadStats(id);
        toast.success("Refill complete", {
          description:
            result.filled === 0
              ? "Subset is already full."
              : `Added ${result.filled} puzzle${result.filled === 1 ? "" : "s"}.`,
        });
      }
    } catch {
    } finally {
      setIsFilling(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await api.subsets.delete(id);
      toast.success("Subset deleted", { description: "The subset has been removed." });
      void navigate({ to: "/app" });
    } catch {
    }
  };

  const handleLock = async (): Promise<void> => {
    try {
      const updated = await api.subsets.lock(id);
      setSubset(updated);
      toast.success("Subset locked", {
        description: "This subset is now frozen and ready for scheduling.",
      });
    } catch {
    }
  };

  if (authLoading || !user) return null;

  if (pageLoading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageWrapper>
    );
  }

  if (!subset) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Subset not found.</p>
      </PageWrapper>
    );
  }

  const locked = subset.status === "locked";
  const isOwn = subset.ownedBy.id === user.id;
  const isBusy = isSaving || isFilling;
  const puzzleCount = subset.puzzleCount;
  const isFull = total >= puzzleCount;
  const fillLabel = total === 0 ? "Fill" : "Refill";

  return (
    <PageWrapper>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><ConceptIcon concept="Subset" />{subset.name}</h1>
        <StatusBadge status={subset.status} />
        <span className="text-sm text-muted-foreground">
          {subset.puzzleCount} puzzles
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <TabsList className="mb-6">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="puzzles">
              Puzzles{total > 0 ? ` (${total})` : ""}
            </TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {!locked && isOwn && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSave()}
                disabled={!isDirty || isBusy}
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>

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
                Configuration is a set of preferences where we sample training items best effort, not hard guarantees.
                We always try to fill to your target count; if the eligible pool is smaller, you get however many puzzles match.
              </p>
            </div>
          )}

          {locked && (
            <div className="mb-4 flex items-center gap-2 rounded-md border px-4 py-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              This subset is locked. Configuration cannot be changed.
            </div>
          )}

          <SourceCompositionEditor
            value={{
              sources: config.sources ?? [],
              subsetRefs: config.subsetRefs ?? [],
            }}
            onChange={(v) =>
              setConfig((prev) => ({
                ...prev,
                sources: v.sources,
                subsetRefs: v.subsetRefs.length > 0 ? v.subsetRefs : undefined,
              }))
            }
            excludeSubsets={config.excludeSubsets ?? []}
            onExcludeSubsetsChange={(v) =>
              setConfig((prev) => ({
                ...prev,
                excludeSubsets: v.length > 0 ? v : undefined,
              }))
            }
            disabled={locked || !isOwn || isBusy}
          />
        </TabsContent>

        <TabsContent value="puzzles">
          {total > 0 ? (
            <PuzzleTable
              subsetId={id}
              locked={locked}
              onTotalChange={handleTotalChange}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No puzzles yet — fill the subset first.
            </p>
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
            <UsedBySchedules subsetId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}
