import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Lock, Undo2 } from "lucide-react";
import { useAuth } from "../context/auth";
import {
  api,
  type Subset,
  type SubsetConfig,
  type Puzzle,
  type SubsetStats as SubsetStatsType,
} from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
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

function SectionHeader({
  title,
  description,
  onReset,
}: {
  title: string;
  description: string;
  onReset?: () => void;
}): React.ReactElement {
  return (
    <div className="mb-4 flex items-start justify-between gap-12">
      <div>
        <h2 className="mb-1 text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {onReset && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="shrink-0 text-muted-foreground"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset section</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function statusBadge(status: Subset["status"]): React.ReactElement {
  const labels: Record<Subset["status"], string> = {
    draft: "Draft",
    filled: "Filled",
    locked: "Locked",
  };
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {labels[status]}
    </Badge>
  );
}

export function SubsetPage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { subsetId } = useParams({ from: "/app/subsets/$subsetId" });
  const id = parseInt(subsetId, 10);

  const [subset, setSubset] = useState<Subset | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("configure");

  const [rating, setRating] = useState<RatingValue>(RATING_DEFAULT);
  const [themes, setThemes] = useState<Record<string, number>>({});
  const [opening, setOpening] = useState<OpeningValue>(OPENING_DEFAULT);
  const [isDirty, setIsDirty] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [stats, setStats] = useState<SubsetStatsType | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/" });
    }
  }, [user, authLoading, navigate]);

  const loadPuzzlesAndStats = useCallback(
    async (subsetIdArg: number): Promise<void> => {
      const [page, s] = await Promise.all([
        api.subsets.getPuzzles(subsetIdArg),
        api.subsets.getStats(subsetIdArg),
      ]);
      setPuzzles(page.puzzles);
      setNextPage(page.nextPage);
      setTotal(page.total);
      setStats(s);
    },
    [],
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
        if (s.status !== "draft") {
          setActiveTab("puzzles");
          await loadPuzzlesAndStats(id);
        }
      })
      .catch(() =>
        toast.error("Failed to load subset", {
          description: "Could not fetch subset data.",
        }),
      )
      .finally(() => setPageLoading(false));
  }, [id, user, loadPuzzlesAndStats]);

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
        setPuzzles([]);
        setStats(null);
        setNextPage(null);
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
        setPuzzles([]);
        setStats(null);
        setNextPage(null);
        setTotal(0);
      }
      if (total === 0) {
        const result = await api.subsets.fill(id);
        const updated = await api.subsets.get(id);
        setSubset(updated);
        await loadPuzzlesAndStats(id);
        setActiveTab("puzzles");
        if (result.filled < result.requested) {
          toast("Fill complete", {
            description: `Filled ${result.filled} of ${result.requested} requested puzzles. Pool may be smaller than expected.`,
          });
        } else {
          toast("Fill complete", {
            description: `${result.filled} puzzles added.`,
          });
        }
      } else {
        const result = await api.subsets.refill(id);
        await loadPuzzlesAndStats(id);
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

  const handleLock = async (): Promise<void> => {
    try {
      const updated = await api.subsets.lock(id);
      setSubset(updated);
      toast("Subset locked", {
        description: "This subset is now frozen and ready for scheduling.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Lock failed", { description: msg });
    }
  };

  const handleDiscard = async (puzzleId: string): Promise<void> => {
    try {
      await api.subsets.discardPuzzle(id, puzzleId);
      setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId));
      setTotal((prev) => prev - 1);
      const updated = await api.subsets.getStats(id);
      setStats(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Remove failed", { description: msg });
    }
  };

  const handleLoadMore = async (): Promise<void> => {
    if (nextPage === null) return;
    setIsLoadingMore(true);
    try {
      const page = await api.subsets.getPuzzles(id, nextPage);
      setPuzzles((prev) => [...prev, ...page.puzzles]);
      setNextPage(page.nextPage);
    } catch {
      toast.error("Failed to load more puzzles", {
        description: "Please try again.",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (authLoading || !user) return null;

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!subset) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Subset not found.</p>
      </div>
    );
  }

  const locked = subset.status === "locked";
  const isBusy = isSaving || isFilling;
  const needsFill = !locked && total < (subset.puzzleCount ?? 0);
  const fillLabel = total === 0 ? "Fill" : "Refill";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
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

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{subset.name}</h1>
        {statusBadge(subset.status)}
        <span className="text-sm text-muted-foreground">
          {subset.puzzleCount} puzzles
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="puzzles">
              Puzzles{total > 0 ? ` (${total})` : ""}
            </TabsTrigger>
          </TabsList>
          {needsFill && (
            <Button
              size="sm"
              onClick={() => void handleFillOrRefill()}
              disabled={isBusy}
            >
              {isFilling ? `${fillLabel}ing…` : fillLabel}
            </Button>
          )}
        </div>
        <Separator className="mb-6 mt-3" />

        <TabsContent value="configure">
          {!locked && (
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

          <div className="flex flex-col gap-8">
            <section>
              <SectionHeader
                title="Rating distribution"
                description="Set the rating range and optionally concentrate the distribution around a specific rating. The chart shows the relative sampling probability at each rating."
                onReset={
                  !locked
                    ? () => {
                        setRating(RATING_DEFAULT);
                        markDirty();
                      }
                    : undefined
                }
              />
              <RatingChart
                value={rating}
                onChange={(v) => {
                  setRating(v);
                  markDirty();
                }}
                disabled={locked || isBusy}
              />
            </section>

            <section>
              <SectionHeader
                title="Theme weights"
                description="Adjust the relative likelihood of each theme. Default weight 1 is neutral. Weight 0 excludes puzzles whose only themes are at zero."
                onReset={
                  !locked
                    ? () => {
                        setThemes({});
                        markDirty();
                      }
                    : undefined
                }
              />
              <ThemeWeights
                value={themes}
                onChange={(v) => {
                  setThemes(v);
                  markDirty();
                }}
                disabled={locked || isBusy}
              />
            </section>

            <Separator />

            <section>
              <SectionHeader
                title="Opening preferences"
                description="Bias sampling towards puzzles from specific openings and control how strongly they are preferred."
                onReset={
                  !locked
                    ? () => {
                        setOpening(OPENING_DEFAULT);
                        markDirty();
                      }
                    : undefined
                }
              />
              <OpeningSelector
                value={opening}
                onChange={(v) => {
                  setOpening(v);
                  markDirty();
                }}
                disabled={locked || isBusy}
              />
            </section>
          </div>
          {!locked && (
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
        </TabsContent>

        <TabsContent value="puzzles">
          {subset.status === "draft" ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Configure and fill the subset to see puzzles here.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setActiveTab("configure")}
              >
                Go to Configure
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {stats && <SubsetStats stats={stats} />}

              <Separator />

              <div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {total} puzzle{total !== 1 ? "s" : ""}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">ID</th>
                        <th className="pb-2 pr-4 font-medium">Rating</th>
                        <th className="pb-2 pr-4 font-medium">Themes</th>
                        <th className="pb-2 pr-4 font-medium">Openings</th>
                        <th className="pb-2 pr-4 font-medium">Popularity</th>
                        <th className="pb-2 pr-4 font-medium">Plays</th>
                        {!locked && <th className="pb-2 font-medium" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {puzzles.map((p) => (
                        <tr key={p.puzzleId}>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {p.puzzleId}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">{p.rating}</td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {p.themes.slice(0, 3).map((t) => (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {t}
                                </Badge>
                              ))}
                              {p.themes.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{p.themes.length - 3}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {p.openings.slice(0, 1).map((o) => (
                                <Badge
                                  key={o}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {o}
                                </Badge>
                              ))}
                              {p.openings.length > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  +{p.openings.length - 1}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {p.popularity}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {p.nbPlays.toLocaleString()}
                          </td>
                          {!locked && (
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => void handleDiscard(p.puzzleId)}
                                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                                aria-label="Remove puzzle"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {nextPage !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => void handleLoadMore()}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading…" : "Load more"}
                  </Button>
                )}
              </div>

              {!locked && (
                <div className="flex flex-wrap items-center gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={total < MIN_LOCK_PUZZLES || isBusy}
                        title={
                          total < MIN_LOCK_PUZZLES
                            ? `Need at least ${MIN_LOCK_PUZZLES} puzzles to lock`
                            : undefined
                        }
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Lock in
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Lock this subset?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Locking is permanent. The subset will be frozen with
                          its current {total} puzzle{total !== 1 ? "s" : ""} and
                          cannot be modified.
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
