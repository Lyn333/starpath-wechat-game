/** 星图档案馆设计：关卡是原创的蛇形航道，用于验证顺序信标与覆盖全格规则。 */
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

export const starChartPuzzle: PuzzleDefinition = {
  id: "archive-01",
  name: "北天航图 · 01",
  size: 6,
  solution,
  walls: buildSurveyWalls(6),
  waypoints: [0, 3, 5, 11, 17, 23, 29, 35].map((index, offset) => ({
    number: offset + 1,
    cell: solution[index],
  })),
};
