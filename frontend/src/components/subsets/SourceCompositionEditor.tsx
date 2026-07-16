import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, CircleHelp, CircleOff, Plus, Trash2 } from "lucide-react";
import {
  ALL_SOURCE_TYPES,
  ORDERED_SOURCES,
  type KnownSource,
  addSource,
  removeSource,
  addSubsetRef as applyAddSubsetRef,
  removeSubsetRef as applyRemoveSubsetRef,
  clearSubsetRefs,
  applySplit,
  updateSourceConfig,
  updateSubsetRefEntry,
} from "../../lib/sourceComposition";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import { Switch } from "../ui/switch";
import { SplitSlider, type SliderSegment } from "./SplitSlider";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Checkbox } from "../ui/checkbox";
import { X } from "lucide-react";
import type {
  DecoySourceConfig,
  SourceEntry,
  SubsetRefEntry,
  LichessTacticSourceConfig,
  ScrapedPositionalSourceConfig,
  Subset,
} from "../../lib/api";
import { api } from "../../lib/api";
import { RatingChart, type RatingValue } from "./RatingChart";
import { ThemeWeights } from "./ThemeWeights";
import { OpeningSelector, type OpeningValue } from "./OpeningSelector";
import { ScrapedPositionalConfig } from "./ScrapedPositionalConfig";
import { TrainingItemTypeBadge } from "../TrainingItemTypeBadge";
import { SubsetSelector } from "./SubsetSelector";
import { SubsetIdentifier, formatLockedDate } from "./SubsetIdentifier";
import { UserAvatar } from "../UserAvatar";
import { ServerDataTable } from "../ServerDataTable";
import type { FetchParams } from "../ServerDataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { DATA_ICONS } from "../../lib/icons";
import { cn } from "../../lib/utils";

const RATING_DEFAULT: RatingValue = {
  min: 1800,
  max: 2600,
  mean: 2200,
  sigma: 100,
};

export const DEFAULT_LICHESS_ENTRY: SourceEntry = {
  source: "LICHESS_TACTIC",
  percentage: 100,
  config: {
    rating: {
      min: RATING_DEFAULT.min,
      max: RATING_DEFAULT.max,
      mean: RATING_DEFAULT.mean ?? undefined,
      sigma: RATING_DEFAULT.sigma ?? undefined,
    },
  },
};

const SOURCE_LABELS: Record<KnownSource, string> = {
  LICHESS_TACTIC: "Lichess Tactics",
  SCRAPED_POSITIONAL: "Scraped Positionals",
  DECOY: "Decoys",
};

const SOURCE_ABOUT_URLS: Record<KnownSource, string> = {
  LICHESS_TACTIC: "/app/sources/lichess-tactics",
  SCRAPED_POSITIONAL: "/app/sources/scraped-positional-puzzles",
  DECOY: "/app/sources/decoys",
};

const SOURCE_BG: Record<KnownSource, string> = {
  LICHESS_TACTIC: "bg-cyan-50 dark:bg-cyan-950/30",
  SCRAPED_POSITIONAL: "bg-indigo-50 dark:bg-indigo-950/30",
  DECOY: "bg-amber-50 dark:bg-amber-950/30",
};

const SUBSET_REF_BG = "bg-zinc-100 dark:bg-zinc-800/50";

const CANDIDATE_MOVE_COUNTS = [3, 4, 5, 6] as const;

type SourceCompositionEditorProps = {
  value: { sources: SourceEntry[]; subsetRefs: SubsetRefEntry[] };
  onChange: (v: { sources: SourceEntry[]; subsetRefs: SubsetRefEntry[] }) => void;
  excludeSubsets: number[];
  onExcludeSubsetsChange: (v: number[]) => void;
  disabled?: boolean;
};

function defaultConfig(
  source: KnownSource,
): LichessTacticSourceConfig | ScrapedPositionalSourceConfig | DecoySourceConfig {
  if (source === "LICHESS_TACTIC") return { ...DEFAULT_LICHESS_ENTRY.config };
  return {};
}

// ─── Decoy config ────────────────────────────────────────────────────────────

function DecoyConfigEditor({
  config,
  onChange,
  disabled,
}: {
  config: DecoySourceConfig;
  onChange: (c: DecoySourceConfig) => void;
  disabled: boolean;
}): React.ReactElement {
  const [countsOpen, setCountsOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  const selectedCounts = config.acceptedMovesCounts ?? [];
  const allSelected = selectedCounts.length === 0 || selectedCounts.length === CANDIDATE_MOVE_COUNTS.length;
  const countsSummary = allSelected ? "All" : `${selectedCounts.length} selected`;

  const toggleCount = (n: number): void => {
    const next = selectedCounts.includes(n)
      ? selectedCounts.filter((c) => c !== n)
      : [...selectedCounts, n];
    onChange({ ...config, acceptedMovesCounts: next.length > 0 && next.length < CANDIDATE_MOVE_COUNTS.length ? next : undefined });
  };

  const opening: OpeningValue = {
    items: config.opening?.items ?? [],
    strength: config.opening?.strength ?? 0,
  };

  const setOpening = (v: OpeningValue): void =>
    onChange({
      ...config,
      opening: v.items.length > 0 ? { items: v.items, strength: v.strength } : undefined,
    });

  return (
    <div className="flex flex-col gap-3">
      <Collapsible open={countsOpen} onOpenChange={setCountsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: countsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Possible candidate moves
            </span>
            <span className="text-xs text-muted-foreground">{countsSummary}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-2 pt-3">
            {CANDIDATE_MOVE_COUNTS.map((n) => {
              const selected = selectedCounts.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleCount(n)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                  <span className="ml-1.5 text-xs opacity-60">moves</span>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openingOpen} onOpenChange={setOpeningOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: openingOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Openings
            </span>
            {opening.items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {opening.items.length} selected
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
            <OpeningSelector value={opening} onChange={setOpening} disabled={disabled} hideWarning />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Lichess Tactic config ───────────────────────────────────────────────────

function LichessTacticConfigEditor({
  config,
  onChange,
  disabled,
}: {
  config: LichessTacticSourceConfig;
  onChange: (c: LichessTacticSourceConfig) => void;
  disabled: boolean;
}): React.ReactElement {
  const [ratingOpen, setRatingOpen] = useState(true);
  const [themesOpen, setThemesOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  const rating: RatingValue = {
    min: config.rating?.min ?? RATING_DEFAULT.min,
    max: config.rating?.max ?? RATING_DEFAULT.max,
    mean: config.rating?.mean ?? RATING_DEFAULT.mean,
    sigma: config.rating?.sigma ?? RATING_DEFAULT.sigma,
  };
  const themes = config.themes ?? {};
  const opening: OpeningValue = {
    items: config.openings?.items ?? [],
    strength: config.openings?.strength ?? 0,
  };

  const setRating = (v: RatingValue): void =>
    onChange({
      ...config,
      rating: {
        min: v.min,
        max: v.max,
        ...(v.mean !== null ? { mean: v.mean } : {}),
        ...(v.sigma !== null ? { sigma: v.sigma } : {}),
      },
    });

  const setThemes = (v: Record<string, number>): void => {
    const filtered = Object.fromEntries(Object.entries(v).filter(([, w]) => w !== 1));
    onChange({ ...config, themes: Object.keys(filtered).length > 0 ? filtered : undefined });
  };

  const setOpening = (v: OpeningValue): void =>
    onChange({
      ...config,
      openings: v.items.length > 0 ? { items: v.items, strength: v.strength } : undefined,
    });

  return (
    <div className="flex flex-col gap-3">
      <Collapsible open={ratingOpen} onOpenChange={setRatingOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: ratingOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Puzzle rating
            </span>
            <span className="text-xs text-muted-foreground">
              {rating.min}–{rating.max}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
            <RatingChart value={rating} onChange={setRating} disabled={disabled} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={themesOpen} onOpenChange={setThemesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: themesOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Tactical themes
            </span>
            <span className="text-xs text-muted-foreground">
              {Object.keys(themes).length > 0
                ? `${Object.keys(themes).length} adjusted`
                : "All equal"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
            <ThemeWeights value={themes} onChange={setThemes} disabled={disabled} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openingOpen} onOpenChange={setOpeningOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: openingOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              Openings
            </span>
            {opening.items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {opening.items.length} selected
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
            <OpeningSelector value={opening} onChange={setOpening} disabled={disabled} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── SubsetRef badge (used in slider segments) ───────────────────────────────

function SubsetRefBadge({
  name,
  ownedBy,
}: {
  name: string;
  ownedBy?: Subset["ownedBy"];
}): React.ReactElement {
  const display = name.length > 14 ? name.slice(0, 14).trimEnd() + "…" : name;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300/60 bg-zinc-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800 dark:text-zinc-300">
      {ownedBy && (
        <UserAvatar
          displayName={ownedBy.displayName}
          avatarUrl={ownedBy.avatarUrl}
          className="h-3.5 w-3.5"
        />
      )}
      {display}
    </span>
  );
}

// ─── SubsetRef row ───────────────────────────────────────────────────────────

function SubsetRefRow({
  entry,
  subset,
  onChange,
  onRemove,
  disabled,
}: {
  entry: SubsetRefEntry;
  subset: Subset | undefined;
  onChange: (e: SubsetRefEntry) => void;
  onRemove: () => void;
  disabled: boolean;
}): React.ReactElement {
  const sourcesInSubset = subset?.config?.sources?.map((s) => s.source) ?? [];
  // Fallback to all sources if we don't know what's in this subset
  const knownSources = sourcesInSubset.length > 0 ? sourcesInSubset : [...ALL_SOURCE_TYPES];

  const toggleSource = (src: string): void => {
    const excluded = entry.excludeSources ?? [];
    const next = excluded.includes(src)
      ? excluded.filter((s) => s !== src)
      : [...excluded, src];
    onChange({ ...entry, excludeSources: next.length > 0 ? next : undefined });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {subset ? (
            <SubsetIdentifier subset={subset} className="min-w-0 flex-1" />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">Subset {entry.subsetId}</span>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Remove reference"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          Get training items from:
        </p>
        {knownSources.map((src) => (
          <label key={src} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={!(entry.excludeSources?.includes(src) ?? false)}
              onCheckedChange={() => toggleSource(src)}
              disabled={disabled}
            />
            <span className="text-xs">{(SOURCE_LABELS as Record<string, string>)[src] ?? src}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Excluded subsets table ───────────────────────────────────────────────────

function ExcludedSubsetsTable({
  excluded,
  options,
  onAdd,
  onRemove,
  disabled,
}: {
  excluded: Subset[];
  options: Subset[];
  onAdd: (s: Subset) => void;
  onRemove: (id: number) => void;
  disabled: boolean;
}): React.ReactElement {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const instanceKey = excluded.map((s) => s.id).join(",");
  const fetchData = useCallback(
    (_params: FetchParams) =>
      Promise.resolve({ items: excluded, total: excluded.length }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instanceKey],
  );

  const columns = useMemo<ColumnDef<Subset>[]>(
    () => [
      {
        id: "creator",
        header: "Creator",
        meta: { icon: DATA_ICONS.user },
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.ownedBy.displayName}
            avatarUrl={row.original.ownedBy.avatarUrl}
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        meta: { icon: DATA_ICONS.name },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "puzzleCount",
        header: "Puzzles",
        meta: { icon: DATA_ICONS.puzzles },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.puzzleCount}
          </span>
        ),
      },
      {
        accessorKey: "lockedAt",
        header: "Locked at",
        meta: { icon: DATA_ICONS.started },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lockedAt ? formatLockedDate(row.original.lockedAt) : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          !disabled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(row.original.id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground ml-auto"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null,
      },
    ],
    [disabled, onRemove],
  );

  return (
    <>
      <ServerDataTable
        tableId="excluded-subsets"
        columns={columns}
        fetchData={fetchData}
        instanceKey={instanceKey}
        pageSize={50}
        initialSorting={[]}
        footerRow={!disabled ? <span className="text-sm text-muted-foreground">+ Add subset</span> : undefined}
        onFooterRowClick={!disabled ? () => setSelectorOpen(true) : undefined}
      />
      {!disabled && (
        <SubsetSelector
          options={options}
          value={[]}
          onChange={(selected) => {
            const added = selected[0];
            if (added) {
              onAdd(added);
              setSelectorOpen(false);
            }
          }}
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
        />
      )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

const REFS_CARD_KEY = "SUBSET_REFS";

export function SourceCompositionEditor({
  value,
  onChange,
  excludeSubsets,
  onExcludeSubsetsChange,
  disabled = false,
}: SourceCompositionEditorProps): React.ReactElement {
  const activeNames = value.sources.map((e) => e.source);
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set());
  const [refsOn, setRefsOn] = useState<boolean>(() => value.subsetRefs.length > 0);
  const refsEnabled = value.subsetRefs.length > 0 || refsOn;

  // All locked subsets — loaded once, used for both referenced and excluded pickers
  const [lockedSubsets, setLockedSubsets] = useState<Subset[]>([]);
  const [subsetMeta, setSubsetMeta] = useState<Map<number, Subset>>(new Map());

  useEffect(() => {
    api.subsets
      .listLocked(200)
      .then((r) => {
        setLockedSubsets(r.items);
        setSubsetMeta((prev) => {
          const next = new Map(prev);
          r.items.forEach((s) => next.set(s.id, s));
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const totalEntries = value.sources.length + value.subsetRefs.length;
  const isRefsOpen = openCards.has(REFS_CARD_KEY);
  const isRefsLast = refsEnabled && value.subsetRefs.length > 0 && value.sources.length === 0;

  const refIds = value.subsetRefs.map((r) => r.subsetId);

  // Subsets currently excluded — used as "value" for the exclude selector
  const excludedSubsets = lockedSubsets.filter((s) => excludeSubsets.includes(s.id));

  const toggleCard = (key: string): void => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSource = (source: KnownSource): void => {
    const isActive = activeNames.includes(source);
    if (isActive) {
      if (totalEntries === 1) return;
      onChange(removeSource(value, source));
      setOpenCards((prev) => {
        const next = new Set(prev);
        next.delete(source);
        return next;
      });
    } else {
      onChange(addSource(value, source, defaultConfig(source)));
    }
  };

  const toggleSubsetRefs = (): void => {
    if (refsEnabled) {
      if (isRefsLast) return;
      setRefsOn(false);
      if (value.subsetRefs.length > 0) {
        onChange(clearSubsetRefs(value));
      }
      setOpenCards((prev) => {
        const next = new Set(prev);
        next.delete(REFS_CARD_KEY);
        return next;
      });
    } else {
      setRefsOn(true);
      setOpenCards((prev) => new Set(prev).add(REFS_CARD_KEY));
    }
  };

  const updateSplit = (newSegments: SliderSegment[]): void => {
    onChange(applySplit(value, newSegments));
  };

  const updateConfig = (
    index: number,
    config: LichessTacticSourceConfig | ScrapedPositionalSourceConfig | DecoySourceConfig,
  ): void => {
    onChange(updateSourceConfig(value, index, config));
  };

  const addSubsetRef = (subset: Subset): void => {
    setSubsetMeta((prev) => {
      if (prev.has(subset.id)) return prev;
      const next = new Map(prev);
      next.set(subset.id, subset);
      return next;
    });
    onChange(applyAddSubsetRef(value, subset.id));
    setOpenCards((prev) => new Set(prev).add(REFS_CARD_KEY));
  };

  const removeSubsetRef = (subsetId: number): void => {
    const newValue = applyRemoveSubsetRef(value, subsetId);
    onChange(newValue);
    if (newValue.subsetRefs.length === 0) {
      setOpenCards((prev) => {
        const next = new Set(prev);
        next.delete(REFS_CARD_KEY);
        return next;
      });
    }
  };

  const updateSubsetRef = (subsetId: number, updated: SubsetRefEntry): void => {
    onChange(updateSubsetRefEntry(value, subsetId, updated));
  };

  const segments: SliderSegment[] = [
    ...ORDERED_SOURCES.filter((s) => activeNames.includes(s)).map((s) => ({
      key: s,
      percentage: value.sources.find((e) => e.source === s)?.percentage ?? 0,
      bgClass: SOURCE_BG[s],
      label: <TrainingItemTypeBadge source={s} />,
    })),
    ...value.subsetRefs.map((ref) => {
      const s = subsetMeta.get(ref.subsetId);
      return {
        key: `ref:${ref.subsetId}`,
        percentage: ref.percentage,
        bgClass: SUBSET_REF_BG,
        label: <SubsetRefBadge name={s?.name ?? `Subset ${ref.subsetId}`} ownedBy={s?.ownedBy} />,
      };
    }),
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Sources (including From Existing Subsets card) ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sources
        </p>

        {ORDERED_SOURCES.map((source) => {
          const isActive = activeNames.includes(source);
          const isOpen = openCards.has(source);
          const isLast = isActive && totalEntries === 1;
          const entryIndex = value.sources.findIndex((e) => e.source === source);
          const entry = value.sources[entryIndex];

          return (
            <Collapsible key={source} open={isActive && isOpen}>
              <div
                className={cn(
                  "rounded-lg border transition-colors",
                  !isActive && "bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    isActive && "cursor-pointer select-none",
                  )}
                  onClick={() => isActive && toggleCard(source)}
                >
                  {isActive ? (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  ) : (
                    <CircleOff className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}

                  <div className="flex flex-1 items-center gap-2">
                    <TrainingItemTypeBadge source={source} />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !isActive && "text-muted-foreground",
                      )}
                    >
                      {SOURCE_LABELS[source]}
                    </span>
                  </div>

                  <a
                    href={SOURCE_ABOUT_URLS[source]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`About ${SOURCE_LABELS[source]}`}
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </a>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => toggleSource(source)}
                          disabled={disabled || isLast}
                          className={isLast ? "disabled:opacity-100" : undefined}
                        />
                      </span>
                    </TooltipTrigger>
                    {isLast && (
                      <TooltipContent>At least one source must be active</TooltipContent>
                    )}
                  </Tooltip>
                </div>

                <CollapsibleContent>
                  {entry && (
                    <div className="border-t px-4 pb-5 pt-4">
                      {entry.source === "DECOY" ? (
                        <DecoyConfigEditor
                          config={entry.config}
                          onChange={(cfg) => updateConfig(entryIndex, cfg)}
                          disabled={disabled}
                        />
                      ) : entry.source === "LICHESS_TACTIC" ? (
                        <LichessTacticConfigEditor
                          config={entry.config}
                          onChange={(cfg) => updateConfig(entryIndex, cfg)}
                          disabled={disabled}
                        />
                      ) : (
                        <ScrapedPositionalConfig
                          value={entry.config}
                          onChange={(cfg) => updateConfig(entryIndex, cfg)}
                          disabled={disabled}
                        />
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* From Existing Subsets — same card style as source cards */}
        <Collapsible open={refsEnabled && isRefsOpen}>
          <div
            className={cn(
              "rounded-lg border transition-colors",
              !refsEnabled && "bg-muted/30",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                refsEnabled && "cursor-pointer select-none",
              )}
              onClick={() => refsEnabled && toggleCard(REFS_CARD_KEY)}
            >
              {refsEnabled ? (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: isRefsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              ) : (
                <CircleOff className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}

              <div className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    !refsEnabled && "text-muted-foreground",
                  )}
                >
                  Existing Subsets
                  {refsEnabled && value.subsetRefs.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({value.subsetRefs.length})
                    </span>
                  )}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={refsEnabled}
                      onCheckedChange={toggleSubsetRefs}
                      disabled={disabled || isRefsLast}
                      className={isRefsLast ? "disabled:opacity-100" : undefined}
                    />
                  </span>
                </TooltipTrigger>
                {isRefsLast && (
                  <TooltipContent>At least one source must be active</TooltipContent>
                )}
              </Tooltip>
            </div>

            <CollapsibleContent>
              <div className="border-t px-4 pb-5 pt-4 flex flex-col gap-3">
                {value.subsetRefs.map((ref) => (
                  <SubsetRefRow
                    key={ref.subsetId}
                    entry={ref}
                    subset={subsetMeta.get(ref.subsetId)}
                    onChange={(updated) => updateSubsetRef(ref.subsetId, updated)}
                    onRemove={() => removeSubsetRef(ref.subsetId)}
                    disabled={disabled}
                  />
                ))}
                {!disabled && (
                  <SubsetSelector
                    options={lockedSubsets.filter((s) => !refIds.includes(s.id))}
                    value={[]}
                    onChange={(selected) => {
                      const added = selected[0];
                      if (added) addSubsetRef(added);
                    }}
                    label="Add subset"
                    placeholder="Add subset"
                    startIcon={Plus}
                  />
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* ── Distribution ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Distribution
        </p>
        <SplitSlider segments={segments} onChange={updateSplit} disabled={disabled} />
      </div>

      {/* ── Excluded Subsets ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Exclude subsets
        </p>
        <p className="text-xs text-muted-foreground">
          You may add any number of existing subsets here whose training items are excluded from use in this new subset.
        </p>
        <ExcludedSubsetsTable
          excluded={excludedSubsets}
          options={lockedSubsets.filter(
            (s) => !excludeSubsets.includes(s.id) && !refIds.includes(s.id),
          )}
          onAdd={(s) => onExcludeSubsetsChange([...excludeSubsets, s.id])}
          onRemove={(id) => onExcludeSubsetsChange(excludeSubsets.filter((x) => x !== id))}
          disabled={disabled ?? false}
        />
      </div>
    </div>
  );
}
