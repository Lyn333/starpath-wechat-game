const { cellKey, normalizePuzzle } = require("./PuzzleSchema");
const { neighbors, wallKey } = require("./PuzzleGenerator");

function sameCell(a, b) { return a.row === b.row && a.col === b.col; }
function isAdjacent(a, b) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1; }
function isBlocked(walls, from, to) { return walls.has(wallKey(from, to)); }

function validateStandardSolution(puzzle) {
  const issues = [];
  const total = puzzle.rows * puzzle.cols;
  const walls = new Set(puzzle.walls);
  if (puzzle.solution.length !== total) issues.push(`标准解长度应为 ${total}，实际为 ${puzzle.solution.length}。`);
  const numberByCell = new Map(puzzle.waypoints.map((item) => [cellKey(item.cell), item.number]));
  let expectedWaypoint = 1;
  for (let index = 0; index < puzzle.solution.length; index += 1) {
    const cell = puzzle.solution[index];
    if (index > 0) {
      const previous = puzzle.solution[index - 1];
      if (!isAdjacent(previous, cell)) issues.push(`标准解第 ${index} 与 ${index + 1} 步不相邻。`);
      if (isAdjacent(previous, cell) && isBlocked(walls, previous, cell)) issues.push(`标准解第 ${index} 与 ${index + 1} 步穿越墙体。`);
    }
    const waypoint = numberByCell.get(cellKey(cell));
    if (waypoint) {
      if (waypoint !== expectedWaypoint) issues.push(`标准解路标顺序错误：期待 ${expectedWaypoint}，实际 ${waypoint}。`);
      expectedWaypoint = waypoint + 1;
    }
  }
  if (expectedWaypoint !== puzzle.waypoints.length + 1) issues.push("标准解未经过全部数字路标。");
  if (puzzle.solution.length && !sameCell(puzzle.solution[0], puzzle.waypoints[0].cell)) issues.push("标准解未从数字 1 开始。");
  if (puzzle.solution.length && !sameCell(puzzle.solution[puzzle.solution.length - 1], puzzle.waypoints[puzzle.waypoints.length - 1].cell)) issues.push("标准解未在最大数字结束。");
  return { valid: issues.length === 0, issues };
}

function countSolutions(puzzle, { maxSolutions = 2, nodeBudget = 150000 } = {}) {
  const walls = new Set(puzzle.walls);
  const total = puzzle.rows * puzzle.cols;
  const numberByCell = new Map(puzzle.waypoints.map((item) => [cellKey(item.cell), item.number]));
  const finalCell = puzzle.waypoints[puzzle.waypoints.length - 1].cell;
  const path = [puzzle.waypoints[0].cell];
  const visited = new Set([cellKey(puzzle.waypoints[0].cell)]);
  const solutions = [];
  let solutionCount = 0, visitedNodes = 0, backtracks = 0, budgetExhausted = false;

  function availableNeighbors(cell) {
    return neighbors(cell, puzzle.rows, puzzle.cols).filter((next) => !isBlocked(walls, cell, next));
  }

  function remainingConnected(tail) {
    const queue = [tail];
    const seen = new Set([cellKey(tail)]);
    while (queue.length) {
      const current = queue.shift();
      for (const next of availableNeighbors(current)) {
        const key = cellKey(next);
        if (seen.has(key) || visited.has(key) && key !== cellKey(tail)) continue;
        seen.add(key); queue.push(next);
      }
    }
    return seen.size === total - visited.size + 1;
  }

  function hasIsolatedRemainingCell(tail) {
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const cell = { row, col }, key = cellKey(cell);
        if (visited.has(key)) continue;
        const degree = availableNeighbors(cell).filter((next) => !visited.has(cellKey(next)) || sameCell(next, tail)).length;
        if (degree === 0) return true;
      }
    }
    return false;
  }

  function search(tail, expectedWaypoint) {
    visitedNodes += 1;
    if (visitedNodes > nodeBudget) { budgetExhausted = true; return; }
    if (solutionCount >= maxSolutions) return;
    if (visited.size === total) {
      if (sameCell(tail, finalCell) && expectedWaypoint === puzzle.waypoints.length + 1) { solutionCount += 1; solutions.push(path.map((cell) => ({ row: cell.row, col: cell.col }))); }
      return;
    }
    if (sameCell(tail, finalCell)) return;
    if (!remainingConnected(tail) || hasIsolatedRemainingCell(tail)) { backtracks += 1; return; }

    const target = puzzle.waypoints[expectedWaypoint - 1]?.cell;
    if (target) {
      const distance = Math.abs(tail.row - target.row) + Math.abs(tail.col - target.col);
      if (distance > total - visited.size) { backtracks += 1; return; }
    }

    const candidates = availableNeighbors(tail).filter((cell) => !visited.has(cellKey(cell))).map((cell) => ({
      cell,
      onward: availableNeighbors(cell).filter((next) => !visited.has(cellKey(next))).length,
    })).sort((a, b) => a.onward - b.onward);

    for (const candidate of candidates) {
      const key = cellKey(candidate.cell);
      const waypoint = numberByCell.get(key);
      if (waypoint && waypoint !== expectedWaypoint) continue;
      visited.add(key); path.push(candidate.cell);
      search(candidate.cell, waypoint ? expectedWaypoint + 1 : expectedWaypoint);
      path.pop(); visited.delete(key);
      if (solutionCount >= maxSolutions || budgetExhausted) return;
    }
    backtracks += 1;
  }

  search(puzzle.waypoints[0].cell, 2);
  const status = budgetExhausted ? "budget-exhausted" : solutionCount === 0 ? "unsolved" : solutionCount === 1 ? "unique" : "multiple";
  return { status, solutionCount, visitedNodes, backtracks, nodeBudget, solutions };
}

function validatePuzzle(input, { checkUniqueness = false, nodeBudget = 150000 } = {}) {
  let puzzle;
  try { puzzle = normalizePuzzle(input); }
  catch (error) { return { valid: false, puzzle: null, issues: [error.message], standardSolution: { valid: false, issues: [error.message] }, uniqueness: { status: "not-checked", solutionCount: 0, visitedNodes: 0, backtracks: 0, nodeBudget, solutions: [] } }; }
  const standardSolution = validateStandardSolution(puzzle);
  const uniqueness = checkUniqueness ? countSolutions(puzzle, { nodeBudget }) : { status: "not-checked", solutionCount: 0, visitedNodes: 0, backtracks: 0, nodeBudget, solutions: [] };
  const uniquenessAcceptable = !checkUniqueness || uniqueness.status === "unique";
  return { valid: standardSolution.valid && uniquenessAcceptable, puzzle, issues: [...standardSolution.issues], standardSolution, uniqueness };
}

module.exports = { countSolutions, isAdjacent, isBlocked, validatePuzzle, validateStandardSolution };
