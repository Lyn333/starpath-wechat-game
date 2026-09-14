const { createSeededRandom, pickIndex, shuffle } = require("./SeededRandom");
const { cellKey, normalizePuzzle, parseGridSize } = require("./PuzzleSchema");

const GENERATOR_VERSION = "seeded-path-v2";
const DIFFICULTY_PROFILES = {
  easy: { waypointRatio: .38, minWaypoints: 10, wallRatio: .04 },
  medium: { waypointRatio: .23, minWaypoints: 8, wallRatio: .08 },
  hard: { waypointRatio: .14, minWaypoints: 6, wallRatio: .12 },
  expert: { waypointRatio: .1, minWaypoints: 5, wallRatio: .15 },
};

function neighbors(cell, rows, cols) {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ].filter((item) => item.row >= 0 && item.row < rows && item.col >= 0 && item.col < cols);
}

function canonicalEdge(a, b) {
  const first = cellKey(a), second = cellKey(b);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function wallKey(a, b) {
  if (a.row === b.row) return `V_${a.row}_${Math.min(a.col, b.col)}`;
  return `H_${Math.min(a.row, b.row)}_${a.col}`;
}

function serpentinePath(rows, cols, random) {
  const path = [];
  for (let row = 0; row < rows; row += 1) {
    for (let index = 0; index < cols; index += 1) path.push({ row, col: row % 2 ? cols - 1 - index : index });
  }
  const transformId = Math.floor(random() * 8);
  const maxRow = rows - 1, maxCol = cols - 1;
  const transform = (cell) => {
    if (transformId === 0) return cell;
    if (transformId === 1) return { row: cell.col, col: maxRow - cell.row };
    if (transformId === 2) return { row: maxRow - cell.row, col: maxCol - cell.col };
    if (transformId === 3) return { row: maxCol - cell.col, col: cell.row };
    if (transformId === 4) return { row: cell.row, col: maxCol - cell.col };
    if (transformId === 5) return { row: maxRow - cell.row, col: cell.col };
    if (transformId === 6) return { row: cell.col, col: cell.row };
    return { row: maxCol - cell.col, col: maxRow - cell.row };
  };
  const result = path.map(transform);
  return random() < .5 ? result : result.reverse();
}

function generateHamiltonianPath(rows, cols, random, nodeBudget = 250000) {
  const total = rows * cols;
  let visitedNodes = 0;
  const starts = shuffle([
    { row: 0, col: 0 },
    { row: 0, col: cols - 1 },
    { row: rows - 1, col: 0 },
    { row: rows - 1, col: cols - 1 },
    { row: pickIndex(random, rows), col: pickIndex(random, cols) },
  ], random);

  for (const start of starts) {
    const path = [start];
    const visited = new Set([cellKey(start)]);
    const search = () => {
      visitedNodes += 1;
      if (visitedNodes > nodeBudget) return false;
      if (path.length === total) return true;
      const tail = path[path.length - 1];
      const candidates = neighbors(tail, rows, cols).filter((cell) => !visited.has(cellKey(cell))).map((cell) => ({
        cell,
        onward: neighbors(cell, rows, cols).filter((next) => !visited.has(cellKey(next))).length,
        jitter: random(),
      })).sort((a, b) => a.onward - b.onward || a.jitter - b.jitter);
      for (const candidate of candidates) {
        if (candidate.onward === 0 && path.length !== total - 1) continue;
        const key = cellKey(candidate.cell);
        visited.add(key); path.push(candidate.cell);
        if (search()) return true;
        path.pop(); visited.delete(key);
      }
      return false;
    };
    if (search()) return { path, source: "warnsdorff", visitedNodes };
  }
  return { path: serpentinePath(rows, cols, random), source: "serpentine-fallback", visitedNodes };
}

function selectWaypoints(solution, profile, random) {
  const target = Math.max(2, Math.min(solution.length, Math.max(profile.minWaypoints, Math.round(solution.length * profile.waypointRatio))));
  const indexes = [0];
  const span = (solution.length - 1) / (target - 1);
  for (let number = 2; number < target; number += 1) {
    const center = Math.round((number - 1) * span);
    const floor = indexes[indexes.length - 1] + 1;
    const ceiling = solution.length - 1 - (target - number);
    const jitter = Math.floor((random() - .5) * Math.max(1, span * .5));
    indexes.push(Math.max(floor, Math.min(ceiling, center + jitter)));
  }
  indexes.push(solution.length - 1);
  return indexes.map((index, offset) => ({ number: offset + 1, cell: solution[index] }));
}

function selectWalls(solution, rows, cols, profile, random) {
  const solutionEdges = new Set();
  for (let index = 1; index < solution.length; index += 1) solutionEdges.add(canonicalEdge(solution[index - 1], solution[index]));
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = { row, col };
      for (const next of [{ row: row + 1, col }, { row, col: col + 1 }]) {
        if (next.row >= rows || next.col >= cols) continue;
        if (!solutionEdges.has(canonicalEdge(cell, next))) candidates.push(wallKey(cell, next));
      }
    }
  }
  const totalEdges = rows * (cols - 1) + cols * (rows - 1);
  const count = Math.min(candidates.length, Math.max(0, Math.round(totalEdges * profile.wallRatio)));
  return shuffle(candidates, random).slice(0, count).sort();
}

function nonSolutionWallCandidates(solution, rows, cols) {
  const solutionEdges = new Set();
  for (let index = 1; index < solution.length; index += 1) solutionEdges.add(canonicalEdge(solution[index - 1], solution[index]));
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = { row, col };
      for (const next of [{ row: row + 1, col }, { row, col: col + 1 }]) {
        if (next.row >= rows || next.col >= cols) continue;
        if (!solutionEdges.has(canonicalEdge(cell, next))) candidates.push(wallKey(cell, next));
      }
    }
  }
  return candidates.sort();
}

function createPuzzleCandidate({ gridSize = "8x8", difficulty = "medium", seed, sourceKind = "seed", title, id, nodeBudget }) {
  if (!seed) throw new Error("生成题目必须提供 seed。");
  const { rows, cols } = parseGridSize(gridSize);
  const profile = DIFFICULTY_PROFILES[difficulty] || DIFFICULTY_PROFILES.medium;
  const random = createSeededRandom(seed);
  const generated = generateHamiltonianPath(rows, cols, random, nodeBudget);
  const solution = generated.path;
  const puzzle = normalizePuzzle({
    id,
    title: title || `${gridSize} ${difficulty}`,
    gridSize,
    difficulty,
    seed,
    sourceKind,
    waypoints: selectWaypoints(solution, profile, random),
    walls: selectWalls(solution, rows, cols, profile, random),
    solution,
    generation: {
      generatorVersion: GENERATOR_VERSION,
      pathSource: generated.source,
      generationNodes: generated.visitedNodes,
    },
  });
  return puzzle;
}

module.exports = {
  DIFFICULTY_PROFILES,
  GENERATOR_VERSION,
  canonicalEdge,
  createPuzzleCandidate,
  generateHamiltonianPath,
  neighbors,
  nonSolutionWallCandidates,
  wallKey,
};
