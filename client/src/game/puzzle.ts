/** 林下探险手册设计：关卡是原创蛇形林径，用于验证路标顺序与覆盖全格规则。 */
import type { Cell, PuzzleDefinition, Wall } from "./types";

function buildSerpentineSolution(size: number): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < size; row += 1) {
    const columns = Array.from({ length: size }, (_, index) => index);
    if (row % 2 === 1) columns.reverse();
    columns.forEach((col) => cells.push({ row, col }));
  }
  return cells;
}

function buildSurveyWalls(size: number): Wall[] {
  const walls: Wall[] = [];
  for (let row = 0; row < size - 1; row += 1) {
    const gateColumn = row % 2 === 0 ? size - 1 : 0;
    for (let col = 0; col < size; col += 1) {
      if (col !== gateColumn) walls.push({ cell: { row, col }, direction: "down" });
    }
  }
  return walls;
}

const solution = buildSerpentineSolution(6);

export const forestTrailPuzzle: PuzzleDefinition = {
  id: "moss-grove-01",
  name: "苔影林地 · 01",
  size: 6,
  solution,
  walls: buildSurveyWalls(6),
  waypoints: [0, 3, 5, 11, 17, 23, 29, 35].map((index, offset) => ({
    number: offset + 1,
    cell: solution[index],
  })),
};
