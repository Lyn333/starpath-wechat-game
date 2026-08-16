import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createSeededPuzzle } from "./seededPuzzle";
import { drawRandomLevel, shuffleLaunchCatalog } from "./randomLevelDraw";
import type { ForestLevel } from "./levelBundle";
import { addContinuation, levelGroupKey, loadContinuations, persistContinuations } from "./continuationLevels";

const levels = [
  createSeededPuzzle({ gridSize: "6x6", difficulty: "easy", seed: "draw-a", ordinal: 1 }),
  createSeededPuzzle({ gridSize: "6x6", difficulty: "easy", seed: "draw-b", ordinal: 2 }),
  createSeededPuzzle({ gridSize: "6x6", difficulty: "easy", seed: "draw-c", ordinal: 3 }),
  createSeededPuzzle({ gridSize: "8x8", difficulty: "medium", seed: "draw-d", ordinal: 1 }),
  createSeededPuzzle({ gridSize: "8x8", difficulty: "medium", seed: "draw-e", ordinal: 2 }),
];

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  } as Storage;
}

describe("random level draw", () => {
  it("shuffles levels inside each size-and-difficulty category without losing or crossing categories", () => {
    const shuffled = shuffleLaunchCatalog(levels, () => 0);
    expect(shuffled.map((level) => level.id).sort()).toEqual(levels.map((level) => level.id).sort());
    expect(shuffled.slice(0, 3).every((level) => level.gridSize === "6x6" && level.difficulty === "easy")).toBe(true);
    expect(shuffled.slice(3).every((level) => level.gridSize === "8x8" && level.difficulty === "medium")).toBe(true);
    expect(shuffled.map((level) => level.id)).not.toEqual(levels.map((level) => level.id));
  });

  it("draws only an unfinished level in the requested category and honors the current-level exclusion", () => {
    const selected = drawRandomLevel({
      levels,
      completed: { [levels[0]!.id]: Date.now() },
      gridSize: "6x6",
      difficulty: "easy",
      excludeId: levels[1]!.id,
      random: () => 0,
    });
    expect(selected?.id).toBe(levels[2]!.id);
    expect(drawRandomLevel({
      levels,
      completed: Object.fromEntries(levels.slice(0, 3).map((level) => [level.id, Date.now()])),
      gridSize: "6x6",
      difficulty: "easy",
    })).toBeNull();
  });

  it("draws from every deployed size-and-difficulty category before its seed continuation fallback", () => {
    const artifact = JSON.parse(readFileSync("/home/ubuntu/webdev-static-assets/forest-trail-launch-catalog-v1.json", "utf8")) as { levels: ForestLevel[] };
    for (const gridSize of ["6x6", "8x8", "10x10", "12x12"] as const) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const group = artifact.levels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty);
        const selected = drawRandomLevel({ levels: artifact.levels, completed: {}, gridSize, difficulty, random: () => 0.5 });
        expect(group).toHaveLength(difficulty === "easy" ? 300 : difficulty === "medium" ? 200 : 100);
        expect(selected && group.some((level) => level.id === selected.id)).toBe(true);
        expect(drawRandomLevel({
          levels: artifact.levels,
          completed: Object.fromEntries(group.map((level) => [level.id, 1])),
          gridSize,
          difficulty,
        })).toBeNull();
      }
    }
  });

  it("keeps all 12 shuffled category orders stable in-session and preserves progress plus persisted continuations by original IDs", () => {
    const artifact = JSON.parse(readFileSync("/home/ubuntu/webdev-static-assets/forest-trail-launch-catalog-v1.json", "utf8")) as { levels: ForestLevel[] };
    const sessionLevels = shuffleLaunchCatalog(artifact.levels, () => 0.25);
    for (const gridSize of ["6x6", "8x8", "10x10", "12x12"] as const) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const initialOrder = sessionLevels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty).map((level) => level.id);
        const selected = drawRandomLevel({ levels: sessionLevels, completed: {}, gridSize, difficulty, random: () => 0.5 });
        expect(selected).not.toBeNull();
        const completed = { [selected!.id]: Date.now() };
        expect(sessionLevels.find((level) => level.id === selected!.id)?.id).toBe(selected!.id);
        expect(drawRandomLevel({ levels: sessionLevels, completed, gridSize, difficulty, random: () => 0.5 })?.id).not.toBe(selected!.id);
        const reopenedOrder = sessionLevels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty).map((level) => level.id);
        expect(reopenedOrder).toEqual(initialOrder);

        const allCompleted = Object.fromEntries(initialOrder.map((id) => [id, Date.now()]));
        expect(drawRandomLevel({ levels: sessionLevels, completed: allCompleted, gridSize, difficulty })).toBeNull();
        const added = addContinuation({ levels: sessionLevels, gridSize, difficulty, continuations: {} });
        expect(new Set(initialOrder).has(added.level.id)).toBe(false);
        expect(new Set(sessionLevels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty).map((level) => level.fingerprint)).has(added.level.fingerprint)).toBe(false);
        const storage = memoryStorage();
        persistContinuations(storage, "random-continuations", added.continuations);
        expect(loadContinuations(storage, "random-continuations")[levelGroupKey(gridSize, difficulty)]?.[0]?.id).toBe(added.level.id);
      }
    }
  });
});
