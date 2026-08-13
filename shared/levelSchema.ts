import { z } from "zod";

export const gridSizeSchema = z.enum(["6x6", "8x8", "10x10", "12x12"]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const levelStatusSchema = z.enum(["draft", "validated", "published", "archived"]);
export const publicationActionSchema = z.enum(["publish", "rollback", "archive"]);

export const cellSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});

export const waypointSchema = z.object({
  number: z.number().int().positive(),
  cell: cellSchema,
});

export const levelSnapshotSchema = z.object({
  rows: z.number().int().min(1).max(12),
  cols: z.number().int().min(1).max(12),
  waypoints: z.array(waypointSchema).min(1),
  walls: z.array(z.string().regex(/^[HV]_\d+_\d+$/)),
  solution: z.array(cellSchema).min(1),
});

export type Cell = z.infer<typeof cellSchema>;
export type LevelSnapshot = z.infer<typeof levelSnapshotSchema>;
export type GridSize = z.infer<typeof gridSizeSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type LevelStatus = z.infer<typeof levelStatusSchema>;

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  summary: {
    expectedCells: number;
    coveredCells: number;
    checkpointCount: number;
    wallCount: number;
  };
};

const allowedSizes: Record<GridSize, number> = {
  "6x6": 6,
  "8x8": 8,
  "10x10": 10,
  "12x12": 12,
};

const cellKey = (cell: Cell) => `${cell.row}-${cell.col}`;

function isAdjacent(a: Cell, b: Cell) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function wallBlocks(from: Cell, to: Cell, walls: Set<string>) {
  if (from.row === to.row) return walls.has(`V_${from.row}_${Math.min(from.col, to.col)}`);
  return walls.has(`H_${Math.min(from.row, to.row)}_${from.col}`);
}

export function validateLevelSnapshot(gridSize: GridSize, snapshot: LevelSnapshot): ValidationResult {
  const errors: string[] = [];
  const expectedDimension = allowedSizes[gridSize];
  const expectedCells = snapshot.rows * snapshot.cols;

  if (snapshot.rows !== expectedDimension || snapshot.cols !== expectedDimension) {
    errors.push(`棋盘尺寸必须与 ${gridSize} 一致。`);
  }

  const inBounds = (cell: Cell) => cell.row >= 0 && cell.row < snapshot.rows && cell.col >= 0 && cell.col < snapshot.cols;
  const pathKeys = new Set<string>();
  snapshot.solution.forEach((cell, index) => {
    if (!inBounds(cell)) errors.push(`解法第 ${index + 1} 步超出棋盘范围。`);
    const key = cellKey(cell);
    if (pathKeys.has(key)) errors.push(`解法重复经过格子 ${key}。`);
    pathKeys.add(key);
  });
  if (snapshot.solution.length !== expectedCells) errors.push(`解法必须覆盖全部 ${expectedCells} 个格子。`);

  const walls = new Set(snapshot.walls);
  if (walls.size !== snapshot.walls.length) errors.push("倒木边界存在重复定义。");
  snapshot.walls.forEach((wall) => {
    const [orientation, rawRow, rawCol] = wall.split("_");
    const row = Number(rawRow);
    const col = Number(rawCol);
    const validHorizontal = orientation === "H" && row >= 0 && row < snapshot.rows - 1 && col >= 0 && col < snapshot.cols;
    const validVertical = orientation === "V" && row >= 0 && row < snapshot.rows && col >= 0 && col < snapshot.cols - 1;
    if (!validHorizontal && !validVertical) errors.push(`倒木边界 ${wall} 超出可编辑范围。`);
  });

  for (let index = 1; index < snapshot.solution.length; index += 1) {
    const previous = snapshot.solution[index - 1];
    const current = snapshot.solution[index];
    if (!isAdjacent(previous, current)) errors.push(`解法第 ${index} 步与第 ${index + 1} 步不正交相邻。`);
    if (wallBlocks(previous, current, walls)) errors.push(`解法穿越了倒木边界（第 ${index} 步）。`);
  }

  const orderedWaypoints = [...snapshot.waypoints].sort((a, b) => a.number - b.number);
  const seenWaypointCells = new Set<string>();
  let previousPathIndex = -1;
  orderedWaypoints.forEach((waypoint, index) => {
    if (waypoint.number !== index + 1) errors.push("路标编号必须从 1 连续递增。");
    if (!inBounds(waypoint.cell)) errors.push(`${waypoint.number} 号路标超出棋盘范围。`);
    const key = cellKey(waypoint.cell);
    if (seenWaypointCells.has(key)) errors.push(`多个路标位于同一格 ${key}。`);
    seenWaypointCells.add(key);
    const pathIndex = snapshot.solution.findIndex((cell) => cellKey(cell) === key);
    if (pathIndex === -1) errors.push(`${waypoint.number} 号路标不在解法路径上。`);
    if (pathIndex !== -1 && pathIndex <= previousPathIndex) errors.push("路标在解法中的经过顺序不正确。");
    previousPathIndex = Math.max(previousPathIndex, pathIndex);
  });

  const start = orderedWaypoints[0];
  const final = orderedWaypoints.at(-1);
  if (start && snapshot.solution[0] && cellKey(start.cell) !== cellKey(snapshot.solution[0])) errors.push("解法必须从 1 号路标开始。");
  const finalCell = snapshot.solution.at(-1);
  if (final && finalCell && cellKey(final.cell) !== cellKey(finalCell)) errors.push("解法必须在最后一个路标结束。");

  return {
    valid: errors.length === 0,
    errors,
    summary: { expectedCells, coveredCells: pathKeys.size, checkpointCount: snapshot.waypoints.length, wallCount: snapshot.walls.length },
  };
}

export function hideSolution(snapshot: LevelSnapshot) {
  const { solution: _solution, ...safeSnapshot } = snapshot;
  return safeSnapshot;
}
