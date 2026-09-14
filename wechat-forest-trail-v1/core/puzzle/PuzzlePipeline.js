const { canonicalEdge, createPuzzleCandidate, nonSolutionWallCandidates, wallKey } = require("./PuzzleGenerator");
const { validatePuzzle } = require("./PuzzleValidator");
const { scoreDifficulty } = require("./DifficultyScorer");
const { normalizePuzzle, parseGridSize } = require("./PuzzleSchema");

function solutionEdges(solution) {
  const result = new Set();
  for (let index = 1; index < solution.length; index += 1) result.add(canonicalEdge(solution[index - 1], solution[index]));
  return result;
}

function blockingWallForAlternative(puzzle, validation, activeWalls) {
  const standardEdges = solutionEdges(puzzle.solution);
  const allowedWalls = new Set(nonSolutionWallCandidates(puzzle.solution, puzzle.rows, puzzle.cols));
  for (const alternative of validation.uniqueness.solutions || []) {
    for (let index = 1; index < alternative.length; index += 1) {
      const edge = canonicalEdge(alternative[index - 1], alternative[index]);
      if (standardEdges.has(edge)) continue;
      const wall = wallKey(alternative[index - 1], alternative[index]);
      if (allowedWalls.has(wall) && !activeWalls.has(wall)) return wall;
    }
  }
  return null;
}

class PuzzlePipeline {
  constructor({ maxAttempts = 6, uniquenessMaxSize = 6, uniquenessNodeBudget = 180000, generationNodeBudget = 250000, uniquenessWallBudget = 24 } = {}) {
    this.maxAttempts = maxAttempts;
    this.uniquenessMaxSize = uniquenessMaxSize;
    this.uniquenessNodeBudget = uniquenessNodeBudget;
    this.generationNodeBudget = generationNodeBudget;
    this.uniquenessWallBudget = uniquenessWallBudget;
  }

  enforceUniqueness(candidate, validation) {
    let puzzle = candidate;
    let current = validation;
    const activeWalls = new Set(candidate.walls);
    let added = 0;
    while (current.uniqueness.status === "multiple" && added < this.uniquenessWallBudget) {
      const wall = blockingWallForAlternative(puzzle, current, activeWalls);
      if (!wall) break;
      activeWalls.add(wall); added += 1;
      puzzle = normalizePuzzle({ ...puzzle, id: undefined, walls: [...activeWalls], generation: { ...puzzle.generation, uniquenessWallsAdded: added } });
      current = validatePuzzle(puzzle, { checkUniqueness: true, nodeBudget: this.uniquenessNodeBudget });
    }
    return { puzzle, validation: current, addedWalls: added };
  }

  build(request) {
    const { rows } = parseGridSize(request.gridSize || "8x8");
    const checkUniqueness = request.checkUniqueness ?? rows <= this.uniquenessMaxSize;
    let lastValidation = null;
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const attemptSeed = attempt === 0 ? request.seed : `${request.seed}:retry:${attempt}`;
      let candidate = createPuzzleCandidate({ ...request, seed: attemptSeed, nodeBudget: this.generationNodeBudget });
      let validation = validatePuzzle(candidate, { checkUniqueness, nodeBudget: this.uniquenessNodeBudget });
      if (checkUniqueness && validation.standardSolution.valid && validation.uniqueness.status === "multiple") {
        const reinforced = this.enforceUniqueness(candidate, validation);
        candidate = reinforced.puzzle;
        validation = reinforced.validation;
      }
      lastValidation = validation;
      if (!validation.standardSolution.valid) continue;
      if (checkUniqueness && validation.uniqueness.status !== "unique") continue;
      const difficultyProfile = scoreDifficulty(validation.puzzle, validation.uniqueness);
      return {
        ...validation.puzzle,
        generation: {
          ...validation.puzzle.generation,
          requestedSeed: request.seed,
          attempt,
          validation: checkUniqueness ? validation.uniqueness.status : "standard-solution",
          solverNodes: validation.uniqueness.visitedNodes,
          solverBacktracks: validation.uniqueness.backtracks,
        },
        difficultyProfile,
      };
    }
    const detail = lastValidation?.uniqueness?.status || lastValidation?.issues?.join("；") || "unknown";
    throw new Error(`题目生成未通过质量门禁：${detail}`);
  }
}

module.exports = { PuzzlePipeline, blockingWallForAlternative, solutionEdges };
