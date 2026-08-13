import { describe, expect, it } from "vitest";
import { type Cell, type LevelSnapshot, hideSolution, validateLevelSnapshot } from "../../shared/levelSchema";

function snakeSolution(size: number): Cell[] {
  const result: Cell[] = [];
  for (let row = 0; row < size; row += 1) {
    const columns = row % 2 === 0 ? [...Array(size).keys()] : [...Array(size).keys()].reverse();
    columns.forEach((col) => result.push({ row, col }));
  }
  return result;
}

function validLevel(): LevelSnapshot {
  const solution = snakeSolution(6);
  return {
    rows: 6,
    cols: 6,
    solution,
    walls: [],
    waypoints: [
      { number: 1, cell: solution[0] },
      { number: 2, cell: solution[12] },
      { number: 3, cell: solution.at(-1)! },
    ],
  };
}

describe("validateLevelSnapshot", () => {
  it("accepts a full, ordered and unblocked path", () => {
    expect(validateLevelSnapshot("6x6", validLevel())).toMatchObject({ valid: true, errors: [] });
  });

  it("rejects a repeated cell and a broken step", () => {
    const snapshot = validLevel();
    snapshot.solution[8] = { ...snapshot.solution[7] };
    const result = validateLevelSnapshot("6x6", snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("重复"))).toBe(true);
  });

  it("rejects a path that crosses a selected fallen-log edge", () => {
    const snapshot = validLevel();
    snapshot.walls = ["V_0_0"];
    const result = validateLevelSnapshot("6x6", snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("穿越"))).toBe(true);
  });

  it("removes the answer path before a published payload reaches the game client", () => {
    const safeSnapshot = hideSolution(validLevel());
    expect(safeSnapshot).not.toHaveProperty("solution");
    expect(safeSnapshot.waypoints).toHaveLength(3);
  });
});
