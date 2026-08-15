const assert = require("node:assert/strict");
const { TrailEngine } = require("./core/TrailEngine");
const { LEVEL_BUNDLE_METADATA, LEVELS } = require("./data/levelBundle");

assert.equal(LEVEL_BUNDLE_METADATA.totalLevels, 200);
assert.equal(LEVELS.length, 200);
assert.equal(new Set(LEVELS.map((level) => level.id)).size, 200);
assert.deepEqual(Object.fromEntries(["6x6", "8x8"].map((gridSize) => [gridSize, LEVELS.filter((level) => level.gridSize === gridSize).length])), { "6x6": 100, "8x8": 100 });

for (const level of LEVELS) {
  assert.equal(level.solution.length, level.rows * level.cols, `${level.id} 必须覆盖全棋盘`);
  const engine = new TrailEngine(level);
  for (const cell of level.solution) assert.equal(engine.tryMove(cell), true, `${level.id} 的预设解法应可执行`);
  assert.equal(engine.getSnapshot().status, "completed", `${level.id} 应能完整通关`);
}

console.log(`已校验 ${LEVELS.length} 道关卡：完整路径、顺序路标与完成状态均正确。`);
