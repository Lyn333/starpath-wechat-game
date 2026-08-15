import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { addContinuation, levelGroupKey, loadContinuations, persistContinuations } from "../../client/src/game/continuationLevels";
import { loadLaunchCatalog } from "../../client/src/game/launchCatalog";
import { createSeededPuzzle } from "../../client/src/game/seededPuzzle";
import { getCompletionAction, getLevelGroup } from "../../client/src/game/webLevelProgress";
import type { ForestGridSize, ForestLevel, LevelDifficulty } from "../../client/src/game/levelBundle";

type LaunchArtifact = { total: number; levels: ForestLevel[] };
const DEPLOYED_CATALOG_PATH = "/home/ubuntu/webdev-static-assets/forest-trail-launch-catalog-v1.json";
const GRID_SIZES: ForestGridSize[] = ["6x6", "8x8", "10x10", "12x12"];
const DIFFICULTIES: LevelDifficulty[] = ["easy", "medium", "hard"];
const QUOTAS: Record<LevelDifficulty, number> = { easy: 300, medium: 200, hard: 100 };

function deployedArtifact(): LaunchArtifact {
  return JSON.parse(readFileSync(DEPLOYED_CATALOG_PATH, "utf8")) as LaunchArtifact;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  } as Storage;
}

describe("launch catalog helpers", () => {
  it("loads only a complete, typed launch catalog payload", async () => {
    const level = createSeededPuzzle({ gridSize: "6x6", difficulty: "easy", seed: "launch-test", ordinal: 1 });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, total: 1, levels: [level] }) });
    await expect(loadLaunchCatalog(fetcher)).resolves.toEqual([level]);
  });

  it("mints and records a non-duplicate continuation at the end of one category", () => {
    const initial = createSeededPuzzle({ gridSize: "10x10", difficulty: "hard", seed: "launch-initial", ordinal: 1 });
    const result = addContinuation({ levels: [initial], gridSize: "10x10", difficulty: "hard", continuations: {} });
    expect(result.level.gridSize).toBe("10x10");
    expect(result.level.fingerprint).not.toBe(initial.fingerprint);
    expect(result.continuations[levelGroupKey("10x10", "hard")]).toHaveLength(1);
  });

  it("ships exactly the requested launch allocation with unique provenance fingerprints", () => {
    const artifact = deployedArtifact();
    expect(artifact.total).toBe(2400);
    expect(artifact.levels).toHaveLength(2400);
    expect(new Set(artifact.levels.map((level) => level.fingerprint)).size).toBe(2400);
    for (const gridSize of GRID_SIZES) {
      expect(artifact.levels.filter((level) => level.gridSize === gridSize && level.difficulty === "easy")).toHaveLength(300);
      expect(artifact.levels.filter((level) => level.gridSize === gridSize && level.difficulty === "medium")).toHaveLength(200);
      expect(artifact.levels.filter((level) => level.gridSize === gridSize && level.difficulty === "hard")).toHaveLength(100);
    }
    expect(artifact.levels.filter((level) => level.sourceKind === "seed-generated")).toHaveLength(717);
    expect(artifact.levels.filter((level) => level.sourceKind === "catalog")).toHaveLength(1683);
  });

  it("uses launch catalog entries before creating and persisting a unique seed continuation in all 12 categories", () => {
    const artifact = deployedArtifact();
    for (const gridSize of GRID_SIZES) {
      for (const difficulty of DIFFICULTIES) {
        const group = getLevelGroup(artifact.levels, gridSize, difficulty);
        const first = group[0];
        const last = group.at(-1);
        expect(group).toHaveLength(QUOTAS[difficulty]);
        expect(first?.sourceKind).toBe("catalog");
        expect(last).toBeDefined();

        const afterFirst = getCompletionAction(group, first!.id, { [first!.id]: Date.now() });
        expect(afterFirst.kind).toBe("next");
        expect(afterFirst.kind === "next" && afterFirst.level.id).toBe(group[1]?.id);

        const finished = Object.fromEntries(group.map((level, index) => [level.id, index + 1]));
        expect(getCompletionAction(group, last!.id, finished).kind).toBe("library");

        const added = addContinuation({ levels: artifact.levels, gridSize, difficulty, continuations: {} });
        const knownFingerprints = new Set(group.map((level) => level.fingerprint));
        expect(knownFingerprints.has(added.level.fingerprint)).toBe(false);
        expect(added.continuations[levelGroupKey(gridSize, difficulty)]).toHaveLength(1);
        const storage = memoryStorage();
        persistContinuations(storage, "continuations", added.continuations);
        expect(loadContinuations(storage, "continuations")[levelGroupKey(gridSize, difficulty)]?.[0]?.fingerprint).toBe(added.level.fingerprint);
      }
    }
  });
});
