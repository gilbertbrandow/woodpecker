# Subset config: SubsetRefs and ExcludedSubsets as separate top-level keys

The Subset config is extended with two new top-level keys alongside `sources`: `subsetRefs` (an array of references to existing locked Subsets that contribute a percentage of the fill) and `excludeSubsets` (an array of locked Subset IDs whose TrainingItems are blocked from sampling across all Sources and SubsetRefs). SubsetRefs are **not** added as a fourth Source type in the `sources` array.

## Considered Options

**Merge SubsetRefs into the `sources` array as a fourth Source type (`EXISTING_SUBSET`).**
Rejected. "Source" in this codebase means an external puzzle data provider with a Pipeline importer (LICHESS_TACTIC, SCRAPED_POSITIONAL, DECOY). An existing Subset is an internal concept, not an external data provider. Adding it as a Source type would corrupt that semantics and make the Source concept harder to reason about everywhere it is used outside of subset configuration.

**Per-source ExcludedSubsets (each Source entry carries its own exclusion list).**
Rejected. Exclusion intent is always "don't give me puzzles I've already seen" — a concern about the final Subset, not about any particular Source. A top-level exclusion applies uniformly across Sources and SubsetRefs with no duplication.

## Consequences

- Percentages across `sources[*].percentage` and `subsetRefs[*].percentage` must sum to 100 together. The existing validation that `sources` alone sums to 100 is replaced by a combined check.
- A SubsetRef ID that also appears in `excludeSubsets` is a ValidationError (contradictory: sample from it and also exclude it).
- Only locked Subsets may appear in either `subsetRefs` or `excludeSubsets` (locked = immutable TrainingItem pool).
