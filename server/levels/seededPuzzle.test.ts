import { describe, expect, it } from "vitest";
import { createNextSeededPuzzle, createSeededPuzzle, validateSeededPuzzle } from "../../client/src/game/seededPuzzle";

describe("seededPuzzle", () => {
  it("recreates the same valid puzzle from the same seed", () => {
    const input = { gridSize: "12x12" as const, difficulty: "hard" as const, seed: "forest-trail:v1:12x12:hard:1:fixed", ordinal: 1 };
    const first = createSeededPuzzle(input);
    const second = createSeededPuzzle(input);
    expect(first).toEqual(second);
    expect(first.solution).toHaveLength(144);
    expect(validateSeededPuzzle(first)).toBe(true);
  });

  it("creates a non-duplicate continuation puzzle", () => {
    const first = createSeededPuzzle({ gridSize: "10x10", difficulty: "medium", seed: "forest-trail:v1:10x10:medium:1:fixed", ordinal: 1 });
    const next = createNextSeededPuzzle({ gridSize: "10x10", difficulty: "medium", ordinal: 2, seenFingerprints: new Set([first.fingerprint]) });
    expect(next.fingerprint).not.toBe(first.fingerprint);
    expect(validateSeededPuzzle(next)).toBe(true);
  });
});
