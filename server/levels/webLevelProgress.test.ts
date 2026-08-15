import { describe, expect, it } from "vitest";
import type { ForestLevel } from "../../client/src/game/levelBundle";
import { getCompletionAction, getLevelGroup, getNextLevel, isLevelUnlocked } from "../../client/src/game/webLevelProgress";

const level = (id: string, gridSize: "6x6" | "8x8", difficulty: "easy" | "medium" | "hard"): ForestLevel => ({ id, name: id, gridSize, difficulty, size: gridSize === "6x6" ? 6 : 8, walls: [], waypoints: [{ number: 1, cell: { row: 0, col: 0 } }], solution: [{ row: 0, col: 0 }] });
const levels = [level("a", "6x6", "easy"), level("b", "6x6", "easy"), level("c", "6x6", "easy"), level("d", "8x8", "easy")];

describe("web level progress", () => {
  it("filters a size-and-difficulty group and unlocks it sequentially", () => {
    const group = getLevelGroup(levels, "6x6", "easy");
    expect(group.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(isLevelUnlocked(group, "a", {})).toBe(true);
    expect(isLevelUnlocked(group, "b", {})).toBe(false);
    expect(isLevelUnlocked(group, "b", { a: 1 })).toBe(true);
    expect(getNextLevel(group, "a", { a: 1 })?.id).toBe("b");
    expect(getNextLevel(group, "c", { a: 1, b: 1, c: 1 })).toBeNull();
    expect(getCompletionAction(group, "a", { a: 1 })).toMatchObject({ kind: "next", level: { id: "b" } });
    expect(getCompletionAction(group, "c", { a: 1, b: 1, c: 1 })).toEqual({ kind: "library" });
  });
});
