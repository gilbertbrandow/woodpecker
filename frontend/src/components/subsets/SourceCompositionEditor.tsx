import * as React from "react";
import { useState, useRef } from "react";
import { ChevronDown, CircleHelp, CircleOff } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import { Switch } from "../ui/switch";
import { SplitSlider } from "./SplitSlider";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type {
  DecoySourceConfig,
  SourceEntry,
  LichessTacticSourceConfig,
  ScrapedPositionalSourceConfig,
} from "../../lib/api";
import { RatingChart, type RatingValue } from "./RatingChart";
import { ThemeWeights } from "./ThemeWeights";
import { OpeningSelector, type OpeningValue } from "./OpeningSelector";
import { ScrapedPositionalConfig } from "./ScrapedPositionalConfig";
import { TrainingItemTypeBadge } from "../TrainingItemTypeBadge";
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

const ALL_SOURCE_TYPES = ["LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"] as const;
type KnownSource = (typeof ALL_SOURCE_TYPES)[number];

const ORDERED_SOURCES: KnownSource[] = ["LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"];

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

type SourceCompositionEditorProps = {
  value: SourceEntry[];
  onChange: (v: SourceEntry[]) => void;
  disabled?: boolean;
};

function equalSplit(sources: SourceEntry[]): SourceEntry[] {
  const n = sources.length;
  if (n === 0) return sources;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return sources.map((s, i) => ({
    ...s,
    percentage: base + (i === 0 ? remainder : 0),
  }));
}

function defaultConfig(
  source: KnownSource,
): LichessTacticSourceConfig | ScrapedPositionalSourceConfig | DecoySourceConfig {
  if (source === "LICHESS_TACTIC") return { ...DEFAULT_LICHESS_ENTRY.config };
  return {};
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
    const filtered = Object.fromEntries(
      Object.entries(v).filter(([, w]) => w !== 1),
    );
    onChange({
      ...config,
      themes: Object.keys(filtered).length > 0 ? filtered : undefined,
    });
  };

  const setOpening = (v: OpeningValue): void =>
    onChange({
      ...config,
      openings:
        v.items.length > 0
          ? { items: v.items, strength: v.strength }
          : undefined,
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
                style={{
                  transform: ratingOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
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
            <RatingChart
              value={rating}
              onChange={setRating}
              disabled={disabled}
            />
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
                style={{
                  transform: themesOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
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
            <ThemeWeights
              value={themes}
              onChange={setThemes}
              disabled={disabled}
            />
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
                style={{
                  transform: openingOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
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
            <OpeningSelector
              value={opening}
              onChange={setOpening}
              disabled={disabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function SourceCompositionEditor({
  value,
  onChange,
  disabled = false,
}: SourceCompositionEditorProps): React.ReactElement {
  const activeNames = value.map((e) => e.source);

  const [openCards, setOpenCards] = useState<Set<KnownSource>>(
    () => new Set<KnownSource>(),
  );

  const suppressSync = useRef(false);

  const toggleSource = (source: KnownSource): void => {
    if (activeNames.includes(source)) {
      if (value.length === 1) return;
      suppressSync.current = true;
      onChange(
        equalSplit(value.filter((s) => s.source !== source)) as SourceEntry[],
      );
      if (openCards.has(source)) {
        setOpenCards((prev) => {
          const next = new Set(prev);
          next.delete(source);
          return next;
        });
      }
    } else {
      suppressSync.current = true;
      const newEntry = {
        source,
        percentage: 0,
        config: defaultConfig(source),
      } as SourceEntry;
      const combined = [...value, newEntry];
      const ordered = ORDERED_SOURCES.filter((s) =>
        combined.some((e) => e.source === s),
      ).map((s) => combined.find((e) => e.source === s)!);
      onChange(equalSplit(ordered) as SourceEntry[]);
    }
  };

  const toggleCard = (source: KnownSource): void => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const updateSplit = (
    newSegments: Array<{ source: string; percentage: number }>,
  ): void => {
    suppressSync.current = true;
    const pctMap = new Map(newSegments.map((s) => [s.source, s.percentage]));
    onChange(
      value.map((e) => ({
        ...e,
        percentage: pctMap.get(e.source) ?? e.percentage,
      })) as SourceEntry[],
    );
  };

  const segments = ORDERED_SOURCES.filter((s) => activeNames.includes(s)).map(
    (s) => ({
      source: s,
      percentage: value.find((e) => e.source === s)?.percentage ?? 0,
    }),
  );

  const updateConfig = (
    index: number,
    config: LichessTacticSourceConfig | ScrapedPositionalSourceConfig | DecoySourceConfig,
  ): void => {
    suppressSync.current = true;
    onChange(
      value.map((e, i) => (i === index ? { ...e, config } : e)) as SourceEntry[],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sources
        </p>

      {ORDERED_SOURCES.map((source) => {
        const isActive = activeNames.includes(source);
        const isOpen = openCards.has(source);
        const isLast = isActive && value.length === 1;
        const entryIndex = value.findIndex((e) => e.source === source);
        const entry = value[entryIndex];

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
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
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
                    <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleSource(source)}
                        disabled={disabled || isLast}
                        className={isLast ? "disabled:opacity-100" : undefined}
                      />
                    </span>
                  </TooltipTrigger>
                  {isLast && (
                    <TooltipContent>
                      At least one source must be active
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>

              <CollapsibleContent>
                {entry && entry.source !== "DECOY" && (
                  <div className="border-t px-4 pb-5 pt-4">
                    {entry.source === "LICHESS_TACTIC" ? (
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
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Distribution
        </p>
        <SplitSlider
          segments={segments}
          onChange={updateSplit}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
