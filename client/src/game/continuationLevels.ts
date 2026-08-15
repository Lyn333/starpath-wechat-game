import { createNextSeededPuzzle, type SeedDifficulty, type SeededForestLevel } from "./seededPuzzle";
import type { ForestLevel, ForestGridSize, LevelDifficulty } from "./levelBundle";

export type ContinuationMap = Record<string, SeededForestLevel[]>;

export function levelGroupKey(gridSize: ForestGridSize, difficulty: LevelDifficulty): string {
  return `${gridSize}:${difficulty}`;
}

export function loadContinuations(storage: Storage, key: string): ContinuationMap {
  try {
    const value = JSON.parse(storage.getItem(key) || "{}");
    return value && typeof value === "object" ? value as ContinuationMap : {};
  } catch {
    return {};
  }
}

export function persistContinuations(storage: Storage, key: string, continuations: ContinuationMap): void {
  storage.setItem(key, JSON.stringify(continuations));
}

export function addContinuation(input: { levels: ForestLevel[]; gridSize: ForestGridSize; difficulty: LevelDifficulty; continuations: ContinuationMap }): { level: SeededForestLevel; continuations: ContinuationMap } {
  const key = levelGroupKey(input.gridSize, input.difficulty);
  const group = input.levels.filter((level) => level.gridSize === input.gridSize && level.difficulty === input.difficulty);
  const seenFingerprints = new Set(group.map((level) => level.fingerprint).filter((fingerprint): fingerprint is string => Boolean(fingerprint)));
  const level = createNextSeededPuzzle({
    gridSize: input.gridSize,
    difficulty: input.difficulty as SeedDifficulty,
    ordinal: group.length + 1,
    seenFingerprints,
  });
  return { level, continuations: { ...input.continuations, [key]: [...(input.continuations[key] ?? []), level] } };
}
