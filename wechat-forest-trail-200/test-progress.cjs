const assert = require("node:assert/strict");

const storage = new Map();
global.wx = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
};

const { ProgressStore } = require("./core/ProgressStore");

const levels = [{ id: "forest-a" }, { id: "forest-b" }, { id: "forest-c" }];
const progress = new ProgressStore();
assert.equal(progress.isUnlocked(levels, 0), true, "首关应默认解锁");
assert.equal(progress.isUnlocked(levels, 1), false, "后一关应在前一关通关前保持锁定");

progress.complete("forest-a", { moves: 35, elapsedMs: 8_000 });
assert.equal(progress.isCompleted("forest-a"), true);
assert.equal(progress.isUnlocked(levels, 1), true, "通过上一关后应解锁下一关");
assert.deepEqual(progress.state.best["forest-a"].moves, 35);

progress.complete("forest-a", { moves: 36, elapsedMs: 2_000 });
assert.equal(progress.state.best["forest-a"].moves, 35, "步数更差的成绩不应覆盖最佳记录");
progress.complete("forest-a", { moves: 35, elapsedMs: 7_000 });
assert.equal(progress.state.best["forest-a"].elapsedMs, 7_000, "同步数且更快的成绩应覆盖最佳记录");

const restored = new ProgressStore();
assert.equal(restored.isCompleted("forest-a"), true, "重启后应恢复本地通关进度");
assert.equal(restored.state.lastLevelId, "forest-a");
console.log("ProgressStore tests passed");
