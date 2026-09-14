const assert = require("assert");
const path = require("path");
const root = path.resolve(__dirname, "..");
const sourcePath = path.resolve(root, "..", "catalog-expanded-source-v2", "launchCatalog.js");
const { LEVELS } = require(sourcePath);
const { loadBucket, LEVEL_BUNDLE_METADATA } = require("../catalog/catalogManifest");
const { hydrateCatalogRecord, recordId } = require("../core/providers/CompactCatalog");
const { validatePuzzle } = require("../core/puzzle/PuzzleValidator");

function visibleFingerprint(level) {
  const waypoints = level.waypoints.map((item) => `${item.number}:${item.cell.row},${item.cell.col}`).join("|");
  return `${level.gridSize}#${level.difficulty}#${[...level.walls].sort().join(",")}#${waypoints}`;
}

const recordsById = new Map();
for (const gridSize of ["6x6", "8x8", "10x10", "12x12"]) for (const difficulty of ["easy", "medium", "hard"]) {
  for (const record of loadBucket(gridSize, difficulty)) recordsById.set(recordId(record), { record, gridSize, difficulty });
}
assert.strictEqual(recordsById.size, 20000);
let legacy = 0, seeded = 0;
for (const level of LEVELS) {
  const found = recordsById.get(level.id);
  assert.ok(found, `紧凑记录缺失：${level.id}`);
  const { record, gridSize, difficulty } = found;
  assert.strictEqual(gridSize, level.gridSize);
  assert.strictEqual(difficulty, level.difficulty);
  const validation = validatePuzzle(level, { checkUniqueness: false });
  assert.strictEqual(validation.standardSolution.valid, true, `${level.id} 标准解无效`);
  if (level.seed) {
    seeded += 1;
    assert.strictEqual(record[0], "s");
    assert.strictEqual(record[3], level.seed);
  } else {
    legacy += 1;
    assert.strictEqual(record[0], "l");
    const restored = hydrateCatalogRecord(record, { gridSize, difficulty });
    assert.strictEqual(visibleFingerprint(restored), visibleFingerprint(level), `${level.id} 可见约束还原不一致`);
    assert.deepStrictEqual(restored.solution, level.solution, `${level.id} 标准解还原不一致`);
  }
}
assert.strictEqual(LEVELS.length, LEVEL_BUNDLE_METADATA.totalLevels);
assert.strictEqual(seeded, 17600);
assert.strictEqual(legacy, 2400);
console.log(`PASS catalog-source-release-validation (${LEVELS.length} levels; ${seeded} seed records; ${legacy} legacy records)`);
