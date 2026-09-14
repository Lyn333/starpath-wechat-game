const { hashString } = require("./SeededRandom");

const PUZZLE_SCHEMA_VERSION = 2;
const SUPPORTED_SIZES = new Set([4, 6, 8, 10, 12]);
const SUPPORTED_DIFFICULTIES = new Set(["easy", "medium", "hard", "expert"]);

function cellKey(cell) { return `${cell.row}-${cell.col}`; }
function copyCell(cell) { return { row: cell.row, col: cell.col }; }
function inBounds(cell, rows, cols) { return Number.isInteger(cell?.row) && Number.isInteger(cell?.col) && cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols; }

function parseGridSize(gridSize) {
  const match = /^(\d+)x(\d+)$/.exec(String(gridSize || ""));
  if (!match) throw new Error(`无效棋盘尺寸：${gridSize}`);
  const rows = Number(match[1]), cols = Number(match[2]);
  if (rows !== cols || !SUPPORTED_SIZES.has(rows)) throw new Error(`暂不支持棋盘尺寸：${gridSize}`);
  return { rows, cols, gridSize: `${rows}x${cols}` };
}

function normalizeWalls(walls, rows, cols) {
  const result = [];
  const seen = new Set();
  for (const wall of walls || []) {
    const match = /^([HV])_(\d+)_(\d+)$/.exec(String(wall));
    if (!match) throw new Error(`无效墙体：${wall}`);
    const direction = match[1], row = Number(match[2]), col = Number(match[3]);
    const valid = direction === "H" ? row >= 0 && row < rows - 1 && col >= 0 && col < cols : row >= 0 && row < rows && col >= 0 && col < cols - 1;
    if (!valid) throw new Error(`墙体越界：${wall}`);
    const normalized = `${direction}_${row}_${col}`;
    if (!seen.has(normalized)) { seen.add(normalized); result.push(normalized); }
  }
  return result.sort();
}

function normalizeWaypoints(waypoints, rows, cols) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) throw new Error("题目至少需要起点和终点两个数字路标。");
  const seen = new Set();
  return [...waypoints].sort((a, b) => a.number - b.number).map((item, index) => {
    if (item.number !== index + 1) throw new Error("路标编号必须从 1 连续递增。");
    if (!inBounds(item.cell, rows, cols)) throw new Error(`路标 ${item.number} 越界。`);
    const key = cellKey(item.cell);
    if (seen.has(key)) throw new Error(`路标 ${item.number} 与其他路标重叠。`);
    seen.add(key);
    return { number: item.number, cell: copyCell(item.cell) };
  });
}

function normalizeSolution(solution, rows, cols) {
  if (!Array.isArray(solution)) return [];
  const seen = new Set();
  return solution.map((cell, index) => {
    if (!inBounds(cell, rows, cols)) throw new Error(`标准解第 ${index + 1} 步越界。`);
    const key = cellKey(cell);
    if (seen.has(key)) throw new Error(`标准解重复经过 ${key}。`);
    seen.add(key);
    return copyCell(cell);
  });
}

function identityPayload(puzzle) {
  return JSON.stringify({
    schemaVersion: PUZZLE_SCHEMA_VERSION,
    seed: puzzle.seed || null,
    gridSize: puzzle.gridSize,
    difficulty: puzzle.difficulty,
    walls: puzzle.walls,
    waypoints: puzzle.waypoints,
  });
}

function stablePuzzleId(puzzle) {
  const prefix = puzzle.sourceKind || "puzzle";
  const digest = hashString(identityPayload(puzzle)).toString(16).padStart(8, "0");
  return `${prefix}-${puzzle.gridSize}-${puzzle.difficulty}-${digest}`;
}

function normalizePuzzle(input) {
  if (!input || typeof input !== "object") throw new Error("题目必须是对象。");
  const dimensions = input.gridSize ? parseGridSize(input.gridSize) : parseGridSize(`${input.rows}x${input.cols}`);
  const difficulty = SUPPORTED_DIFFICULTIES.has(input.difficulty) ? input.difficulty : "medium";
  const puzzle = {
    ...input,
    schemaVersion: PUZZLE_SCHEMA_VERSION,
    gridSize: dimensions.gridSize,
    rows: dimensions.rows,
    cols: dimensions.cols,
    difficulty,
    sourceKind: input.sourceKind || "seed",
    seed: input.seed || null,
    walls: normalizeWalls(input.walls, dimensions.rows, dimensions.cols),
    waypoints: normalizeWaypoints(input.waypoints, dimensions.rows, dimensions.cols),
    solution: normalizeSolution(input.solution, dimensions.rows, dimensions.cols),
  };
  puzzle.id ||= stablePuzzleId(puzzle);
  return puzzle;
}

module.exports = {
  PUZZLE_SCHEMA_VERSION,
  SUPPORTED_DIFFICULTIES,
  SUPPORTED_SIZES,
  cellKey,
  copyCell,
  inBounds,
  normalizePuzzle,
  parseGridSize,
  stablePuzzleId,
};
