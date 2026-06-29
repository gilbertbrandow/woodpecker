import type {
  DecoySourceConfig,
  LichessTacticSourceConfig,
  ScrapedPositionalSourceConfig,
  SourceEntry,
  SubsetRefEntry,
} from "./api";

export const ALL_SOURCE_TYPES = ["LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"] as const;
export type KnownSource = (typeof ALL_SOURCE_TYPES)[number];
export const ORDERED_SOURCES: KnownSource[] = ["LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"];

export type SourceCompositionValue = {
  sources: SourceEntry[];
  subsetRefs: SubsetRefEntry[];
};

type AnySourceConfig =
  | LichessTacticSourceConfig
  | ScrapedPositionalSourceConfig
  | DecoySourceConfig;

export function equalSplitAll<T extends { percentage: number }>(entries: T[]): T[] {
  const n = entries.length;
  if (n === 0) return entries;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return entries.map((e, i) => ({ ...e, percentage: base + (i === 0 ? remainder : 0) }));
}

export function addSource(
  current: SourceCompositionValue,
  source: KnownSource,
  config: AnySourceConfig,
): SourceCompositionValue {
  const activeNames = current.sources.map((e) => e.source);
  const newEntry = { source, percentage: 0, config } as SourceEntry;
  const ordered = ORDERED_SOURCES.filter((s) => [...activeNames, source].includes(s)).map((s) =>
    s === source ? newEntry : current.sources.find((e) => e.source === s)!,
  );
  const combined = [...ordered, ...current.subsetRefs];
  const equalized = equalSplitAll(combined);
  const nSrc = ordered.length;
  return {
    sources: equalized.slice(0, nSrc) as SourceEntry[],
    subsetRefs: equalized.slice(nSrc) as SubsetRefEntry[],
  };
}

export function removeSource(
  current: SourceCompositionValue,
  source: KnownSource,
): SourceCompositionValue {
  const newSources = current.sources.filter((s) => s.source !== source);
  const combined = [...newSources, ...current.subsetRefs];
  const equalized = equalSplitAll(combined);
  const nSrc = newSources.length;
  return {
    sources: equalized.slice(0, nSrc) as SourceEntry[],
    subsetRefs: equalized.slice(nSrc) as SubsetRefEntry[],
  };
}

export function addSubsetRef(
  current: SourceCompositionValue,
  subsetId: number,
): SourceCompositionValue {
  const newRef: SubsetRefEntry = { subsetId, percentage: 0 };
  const combined = [...current.sources, ...current.subsetRefs, newRef];
  const equalized = equalSplitAll(combined);
  const nSrc = current.sources.length;
  const nRef = current.subsetRefs.length + 1;
  return {
    sources: equalized.slice(0, nSrc) as SourceEntry[],
    subsetRefs: equalized.slice(nSrc, nSrc + nRef) as SubsetRefEntry[],
  };
}

export function removeSubsetRef(
  current: SourceCompositionValue,
  subsetId: number,
): SourceCompositionValue {
  const newRefs = current.subsetRefs.filter((r) => r.subsetId !== subsetId);
  const combined = [...current.sources, ...newRefs];
  const equalized = equalSplitAll(combined);
  const nSrc = current.sources.length;
  return {
    sources: equalized.slice(0, nSrc) as SourceEntry[],
    subsetRefs: equalized.slice(nSrc) as SubsetRefEntry[],
  };
}

export function clearSubsetRefs(current: SourceCompositionValue): SourceCompositionValue {
  return {
    sources: equalSplitAll(current.sources) as SourceEntry[],
    subsetRefs: [],
  };
}

export function applySplit(
  current: SourceCompositionValue,
  newSegments: Array<{ key: string; percentage: number }>,
): SourceCompositionValue {
  const pctMap = new Map(newSegments.map((s) => [s.key, s.percentage]));
  return {
    sources: current.sources.map((e) => ({
      ...e,
      percentage: pctMap.get(e.source) ?? e.percentage,
    })) as SourceEntry[],
    subsetRefs: current.subsetRefs.map((r) => ({
      ...r,
      percentage: pctMap.get(`ref:${r.subsetId}`) ?? r.percentage,
    })),
  };
}

export function updateSourceConfig(
  current: SourceCompositionValue,
  index: number,
  config: AnySourceConfig,
): SourceCompositionValue {
  return {
    ...current,
    sources: current.sources.map((e, i) => (i === index ? { ...e, config } : e)) as SourceEntry[],
  };
}

export function updateSubsetRefEntry(
  current: SourceCompositionValue,
  subsetId: number,
  updated: SubsetRefEntry,
): SourceCompositionValue {
  return {
    ...current,
    subsetRefs: current.subsetRefs.map((r) => (r.subsetId === subsetId ? updated : r)),
  };
}
