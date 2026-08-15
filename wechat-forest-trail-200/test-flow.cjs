const assert = require("node:assert/strict");

const storage = new Map();
global.wx = {
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
};

function fakeCanvas() {
  const context = new Proxy({}, {
    get(target, property) {
      if (property === "createLinearGradient") return () => ({ addColorStop() {} });
      if (property in target) return target[property];
      return () => {};
    },
  });
  return { width: 0, height: 0, getContext: () => context };
}

const { LEVELS } = require("./data/levelBundle");
const { ProgressStore } = require("./core/ProgressStore");
const { LevelLibraryRenderer } = require("./core/LevelLibraryRenderer");
const { ForestPathGame } = require("./core/GameFlow");

const library = new LevelLibraryRenderer(fakeCanvas(), LEVELS, new ProgressStore());
assert.equal(library.visibleLevels().length, 34, "默认应显示 6×6 林缘 34 关");
library.setDifficulty("medium");
assert.equal(library.visibleLevels().length, 33, "林间难度应显示 33 关");
library.setSize("8x8");
assert.equal(library.visibleLevels().length, 33, "8×8 林间难度应显示 33 关");
library.nextPage();
assert.equal(library.page, 1, "关卡目录应支持分页");

const game = new ForestPathGame(fakeCanvas());
const size8 = game.library.bounds.size.find((item) => item.value === "8x8");
game.touchStart({ touches: [{ clientX: size8.x + 2, clientY: size8.y + 2 }] });
assert.equal(game.library.gridSize, "8x8", "点击尺寸筛选应更新目录");
const medium = game.library.bounds.difficulty.find((item) => item.value === "medium");
game.touchStart({ touches: [{ clientX: medium.x + 2, clientY: medium.y + 2 }] });
assert.equal(game.library.difficulty, "medium", "点击难度筛选应更新目录");

const firstCard = game.library.bounds.cards[0];
game.touchStart({ touches: [{ clientX: firstCard.x + 2, clientY: firstCard.y + 2 }] });
const firstLevel = game.currentLevel;
assert.equal(game.mode, "play", "点击已解锁关卡应进入游玩状态");
assert.equal(firstLevel.gridSize, "8x8");
assert.equal(firstLevel.difficulty, "medium");
for (const cell of firstLevel.solution) assert.equal(game.engine.tryMove(cell), true, "第一个关卡的预设解法应完整可走");
assert.equal(game.engine.getSnapshot().status, "completed");
assert.equal(game.progress.isCompleted(firstLevel.id), true, "通关后应写入本地进度");
assert.ok(game.nextBounds, "通关后应出现下一关操作区");
game.touchStart({ touches: [{ clientX: game.nextBounds.x + 2, clientY: game.nextBounds.y + 2 }] });
assert.equal(game.currentLevel.gridSize, "8x8", "下一关应保留尺寸分组");
assert.equal(game.currentLevel.difficulty, "medium", "下一关应保留难度分组");
assert.notEqual(game.currentLevel.id, firstLevel.id, "下一关操作应进入同组后一关");

const restored = new ProgressStore();
assert.equal(restored.isCompleted(firstLevel.id), true, "重新创建进度仓库后应恢复通关记录");
console.log("LevelLibraryRenderer and ForestPathGame flow tests passed");
