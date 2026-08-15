import { directionBetween, sameCell, type Cell, type Direction, type PuzzleDefinition, type Wall } from "./types";

export type SeedGridSize = "6x6" | "8x8" | "10x10" | "12x12";
export type SeedDifficulty = "easy" | "medium" | "hard";
export type SeedSourceKind = "seed-generated";

export interface SeededForestLevel extends PuzzleDefinition {
  gridSize: SeedGridSize;
  difficulty: SeedDifficulty;
  seed: string;
  sourceKind: SeedSourceKind;
  fingerprint: string;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gridLength(gridSize: SeedGridSize): number {
  return Number(gridSize.split("x")[0]);
}

function toKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

function edgeKey(from: Cell, to: Cell): string {
  return [toKey(from), toKey(to)].sort().join("|");
}

function transformCell(cell: Cell, size: number, mode: number): Cell {
  const max = size - 1;
  if (mode === 0) return cell;
  if (mode === 1) return { row: cell.col, col: max - cell.row };
  if (mode === 2) return { row: max - cell.row, col: max - cell.col };
  if (mode === 3) return { row: max - cell.col, col: cell.row };
  if (mode === 4) return { row: cell.row, col: max - cell.col };
  if (mode === 5) return { row: max - cell.row, col: cell.col };
  if (mode === 6) return { row: cell.col, col: cell.row };
  return { row: max - cell.col, col: max - cell.row };
}

function serpentineSolution(size: number, mode: number): Cell[] {
  const base: Cell[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let offset = 0; offset < size; offset += 1) {
      base.push({ row, col: row % 2 === 0 ? offset : size - 1 - offset });
    }
  }
  return base.map((cell) => transformCell(cell, size, mode));
}

function sampleWaypoints(solution: Cell[], difficulty: SeedDifficulty, random: () => number) {
  const countByDifficulty: Record<SeedDifficulty, number> = {
    easy: Math.max(8, Math.floor(solution.length / 10)),
    medium: Math.max(12, Math.floor(solution.length / 7)),
    hard: Math.max(16, Math.floor(solution.length / 5)),
  };
  const count = Math.min(solution.length, countByDifficulty[difficulty]);
  const indices = [0];
  const span = (solution.length - 1) / (count - 1);
  for (let number = 2; number < count; number += 1) {
    const center = Math.round((number - 1) * span);
    const jitter = Math.floor((random() - 0.5) * Math.max(1, span * 0.55));
    const minimum = indices[indices.length - 1] + 1;
    const maximum = solution.length - 1 - (count - number);
    indices.push(Math.min(maximum, Math.max(minimum, center + jitter)));
  }
  indices.push(solution.length - 1);
  return indices.map((index, offset) => ({ number: offset + 1, cell: solution[index] }));
}

function safeWalls(solution: Cell[], size: number, difficulty: SeedDifficulty, random: () => number): Wall[] {
  const solutionEdges = new Set<string>();
  for (let index = 1; index < solution.length; index += 1) solutionEdges.add(edgeKey(solution[index - 1], solution[index]));

  const candidates: Wall[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = { row, col };
      if (col < size - 1 && !solutionEdges.has(edgeKey(cell, { row, col: col + 1 }))) candidates.push({ cell, direction: "right" });
      if (row < size - 1 && !solutionEdges.has(edgeKey(cell, { row: row + 1, col }))) candidates.push({ cell, direction: "down" });
    }
  }
  const target = Math.min(candidates.length, { easy: Math.max(2, Math.floor(size / 2)), medium: size, hard: size + Math.floor(size / 2) }[difficulty]);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
  }
  return candidates.slice(0, target);
}

function fingerprintFor(solution: Cell[], waypoints: { number: number; cell: Cell }[], walls: Wall[]): string {
  const payload = JSON.stringify({ solution, waypoints, walls });
  return hashSeed(payload).toString(16).padStart(8, "0");
}

export function createSeededPuzzle(input: { gridSize: SeedGridSize; difficulty: SeedDifficulty; seed: string; ordinal: number }): SeededForestLevel {
  const size = gridLength(input.gridSize);
  const random = createRandom(input.seed);
  const solution = serpentineSolution(size, Math.floor(random() * 8));
  const waypoints = sampleWaypoints(solution, input.difficulty, random);
  const walls = safeWalls(solution, size, input.difficulty, random);
  const fingerprint = fingerprintFor(solution, waypoints, walls);
  return {
    id: `seed-${input.gridSize}-${input.difficulty}-${input.ordinal}-${fingerprint}`,
    name: `种子林径 · ${String(input.ordinal).padStart(3, "0")}`,
    gridSize: input.gridSize,
    difficulty: input.difficulty,
    seed: input.seed,
    sourceKind: "seed-generated",
    fingerprint,
    size,
    waypoints,
    walls,
    solution,
  };
}

export function createContinuationSeed(gridSize: SeedGridSize, difficulty: SeedDifficulty, ordinal: number): string {
  const salt = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `forest-trail:v1:${gridSize}:${difficulty}:${ordinal}:${salt}`;
}

export function createNextSeededPuzzle(input: { gridSize: SeedGridSize; difficulty: SeedDifficulty; ordinal: number; seenFingerprints: ReadonlySet<string> }): SeededForestLevel {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const seed = `${createContinuationSeed(input.gridSize, input.difficulty, input.ordinal)}:${attempt}`;
    const level = createSeededPuzzle({ ...input, seed });
    if (!input.seenFingerprints.has(level.fingerprint)) return level;
  }
  throw new Error("无法生成未重复的续关谜题");
}

export function validateSeededPuzzle(level: SeededForestLevel): boolean {
  if (level.solution.length !== level.size * level.size || level.waypoints.length < 2) return false;
  if (new Set(level.solution.map(toKey)).size !== level.solution.length) return false;
  for (let index = 1; index < level.solution.length; index += 1) {
    if (!directionBetween(level.solution[index - 1], level.solution[index])) return false;
  }
  if (!sameCell(level.waypoints[0].cell, level.solution[0])) return false;
  if (!sameCell(level.waypoints[level.waypoints.length - 1].cell, level.solution[level.solution.length - 1])) return false;
  const solutionEdges = new Set(level.solution.slice(1).map((cell, index) => edgeKey(level.solution[index], cell)));
  return level.walls.every((wall) => {
    const delta: Record<Direction, Cell> = {
      up: { row: wall.cell.row - 1, col: wall.cell.col },
      right: { row: wall.cell.row, col: wall.cell.col + 1 },
      down: { row: wall.cell.row + 1, col: wall.cell.col },
      left: { row: wall.cell.row, col: wall.cell.col - 1 },
    };
    const neighbor = delta[wall.direction];
    return neighbor.row >= 0 && neighbor.row < level.size && neighbor.col >= 0 && neighbor.col < level.size && !solutionEdges.has(edgeKey(wall.cell, neighbor));
  });
}
