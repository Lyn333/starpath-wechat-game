/** 星图档案馆设计：此文件仅定义可移植谜题数据，不携带 React、DOM 或渲染细节。 */
export type Direction = "up" | "right" | "down" | "left";

export interface Cell {
  row: number;
  col: number;
}

export interface Waypoint {
  number: number;
  cell: Cell;
}

export interface Wall {
  cell: Cell;
  direction: Direction;
}

export interface PuzzleDefinition {
  id: string;
  name: string;
  size: number;
  waypoints: Waypoint[];
  walls: Wall[];
  solution: Cell[];
}

export type GameStatus = "idle" | "active" | "completed";

export interface GameSnapshot {
  path: Cell[];
  status: GameStatus;
  nextWaypoint: number;
  elapsedMs: number;
  moves: number;
  message: string;
  hintCells: Cell[];
}

export const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

export const cellKey = (cell: Cell) => `${cell.row}:${cell.col}`;

export const oppositeDirection = (direction: Direction): Direction => {
  if (direction === "up") return "down";
  if (direction === "down") return "up";
  if (direction === "left") return "right";
  return "left";
};

export const directionBetween = (from: Cell, to: Cell): Direction | null => {
  if (to.row === from.row - 1 && to.col === from.col) return "up";
  if (to.row === from.row + 1 && to.col === from.col) return "down";
  if (to.row === from.row && to.col === from.col - 1) return "left";
  if (to.row === from.row && to.col === from.col + 1) return "right";
  return null;
};
