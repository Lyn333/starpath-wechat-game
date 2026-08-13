import { describe, expect, it } from "vitest";
import { applyEditorCellEdit, makeStarterSnapshot } from "../../shared/levelEditorOps";

describe("level editor cell operations", () => {
  it("toggles a fallen-log edge and clears it from the same grid location", () => {
    const level = makeStarterSnapshot("6x6");
    const withWall = applyEditorCellEdit(level, { row: 2, col: 2 }, "wallH").snapshot;
    expect(withWall.walls).toContain("H_2_2");
    expect(applyEditorCellEdit(withWall, { row: 2, col: 2 }, "wallH").snapshot.walls).not.toContain("H_2_2");
  });

  it("removes a trail marker and maintains a continuous marker sequence", () => {
    const level = makeStarterSnapshot("6x6");
    const withoutMiddleMarker = applyEditorCellEdit(level, level.waypoints[2].cell, "waypoint").snapshot;
    expect(withoutMiddleMarker.waypoints.map((marker) => marker.number)).toEqual([1, 2, 3, 4]);
  });

  it("rejects a non-adjacent trail extension and reports the edit reason", () => {
    const incomplete = { ...makeStarterSnapshot("6x6"), solution: [{ row: 0, col: 0 }] };
    const result = applyEditorCellEdit(incomplete, { row: 2, col: 2 }, "solution");
    expect(result.snapshot.solution).toHaveLength(1);
    expect(result.message).toContain("上下左右相邻");
  });
});
