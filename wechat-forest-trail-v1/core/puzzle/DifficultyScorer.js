const { cellKey, normalizePuzzle } = require("./PuzzleSchema");
const { neighbors, wallKey } = require("./PuzzleGenerator");

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

function countTurns(solution) {
  let turns = 0;
  for (let index = 2; index < solution.length; index += 1) {
    const a = solution[index - 2], b = solution[index - 1], c = solution[index];
    const first = { row: b.row - a.row, col: b.col - a.col };
    const second = { row: c.row - b.row, col: c.col - b.col };
    if (first.row !== second.row || first.col !== second.col) turns += 1;
  }
  return turns;
}

function visibleDegree(puzzle, cell, walls) {
  return neighbors(cell, puzzle.rows, puzzle.cols).filter((next) => !walls.has(wallKey(cell, next))).length;
}

function scoreDifficulty(input, solverStats = {}) {
  const puzzle = normalizePuzzle(input);
  const cellCount = puzzle.rows * puzzle.cols;
  const totalEdges = puzzle.rows * (puzzle.cols - 1) + puzzle.cols * (puzzle.rows - 1);
  const walls = new Set(puzzle.walls);
  const waypointDensity = puzzle.waypoints.length / cellCount;
  const wallDensity = totalEdges ? puzzle.walls.length / totalEdges : 0;
  const turnCount = countTurns(puzzle.solution);
  const turnRatio = puzzle.solution.length > 2 ? turnCount / (puzzle.solution.length - 2) : 0;
  let branchingCells = 0;
  for (let row = 0; row < puzzle.rows; row += 1) for (let col = 0; col < puzzle.cols; col += 1) if (visibleDegree(puzzle, { row, col }, walls) >= 3) branchingCells += 1;
  const branchRatio = branchingCells / cellCount;
  const searchScore = solverStats.visitedNodes ? clamp(Math.log10(solverStats.visitedNodes + 1) / 6) : 0;
  const backtrackScore = solverStats.backtracks ? clamp(Math.log10(solverStats.backtracks + 1) / 5) : 0;

  const components = {
    waypointScarcity: clamp((.45 - waypointDensity) / .38),
    wallComplexity: clamp(wallDensity / .18),
    turns: clamp(turnRatio / .65),
    branching: clamp(branchRatio / .75),
    search: clamp(searchScore * .65 + backtrackScore * .35),
  };
  const score = Math.round(100 * (
    components.waypointScarcity * .30 +
    components.wallComplexity * .15 +
    components.turns * .20 +
    components.branching * .15 +
    components.search * .20
  ));
  const label = score <= 34 ? "easy" : score <= 67 ? "medium" : "hard";
  const sizeBase = 300 + Math.max(0, puzzle.rows - 4) * 100;
  const rating = Math.round(clamp(sizeBase + score * 10, 0, 2000));

  return {
    score,
    label,
    rating,
    waypointDensity,
    wallDensity,
    turnCount,
    branchingCells,
    solverNodes: solverStats.visitedNodes || 0,
    solverBacktracks: solverStats.backtracks || 0,
    components,
  };
}

module.exports = { clamp, countTurns, scoreDifficulty };
