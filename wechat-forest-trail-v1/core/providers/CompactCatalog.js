const { PuzzlePipeline } = require("../puzzle/PuzzlePipeline");
const { normalizePuzzle, parseGridSize } = require("../puzzle/PuzzleSchema");

function createCatalogPipeline() { return new PuzzlePipeline({ maxAttempts: 12, uniquenessMaxSize: 6, uniquenessNodeBudget: 250000, generationNodeBudget: 500000, uniquenessWallBudget: 24 }); }

function decodeIndexes(encoded) {
  return Array.from(String(encoded || ""), (character) => character.charCodeAt(0) - 33);
}

function cellAt(index, cols) { return { row: Math.floor(index / cols), col: index % cols }; }

function hydrateLegacyRecord(record, gridSize, difficulty) {
  const [, id, title, encodedSolution, encodedWaypoints, walls] = record;
  const { rows, cols } = parseGridSize(gridSize);
  const solution = decodeIndexes(encodedSolution).map((index) => cellAt(index, cols));
  const waypoints = decodeIndexes(encodedWaypoints).map((index, offset) => ({ number: offset + 1, cell: cellAt(solution[index].row * cols + solution[index].col, cols) }));
  return normalizePuzzle({ id, title, gridSize, difficulty, rows, cols, sourceKind: "catalog", walls, waypoints, solution });
}

function hydrateSeedRecord(record, gridSize, difficulty, pipeline) {
  const [, id, title, seed] = record;
  const generated = pipeline.build({ id, gridSize, difficulty, seed, sourceKind: "catalog", title });
  return { ...generated, id, title };
}

function hydrateCatalogRecord(record, { gridSize, difficulty, pipeline = createCatalogPipeline() } = {}) {
  if (!Array.isArray(record)) throw new Error("紧凑题库记录必须是数组。");
  if (record[0] === "l") return hydrateLegacyRecord(record, gridSize, difficulty);
  if (record[0] === "s") return hydrateSeedRecord(record, gridSize, difficulty, pipeline);
  throw new Error(`未知紧凑题库记录类型：${record[0]}`);
}

function recordId(record) { return record?.[1] || null; }

module.exports = { createCatalogPipeline, decodeIndexes, hydrateCatalogRecord, hydrateLegacyRecord, hydrateSeedRecord, recordId };
