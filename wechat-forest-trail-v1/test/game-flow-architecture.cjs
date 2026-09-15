const assert = require("assert");
const { ForestTrailMiniGame } = require("../core/GameFlow");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ProgressStore } = require("../core/ProgressStore");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { HybridLevelProvider } = require("../core/providers/HybridLevelProvider");

class RendererMock {
  constructor() { this.controls = {}; this.completionFireworks = null; this.effectStarts = 0; this.effectClears = 0; }
  setLevel(level) { this.level = level; }
  startCompletionFireworks(startedAt) { this.effectStarts += 1; this.completionFireworks = { startedAt }; }
  clearCompletionFireworks() { this.effectClears += 1; this.completionFireworks = null; }
  render() {}
  hit(box, point) { return Boolean(box && point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height); }
  resize() {}
  toCell() { return null; }
}
class SoundMock {
  constructor() { this.celebrations = 0; }
  startBackgroundMusic() {}
  setEnabled() {}
  tap() {}
  coin() {}
  undo() {}
  reset() {}
  complete() {}
  playCompletionCelebration() { this.celebrations += 1; }
  destroy() {}
}
class LeaderboardMock {
  initialize() { return Promise.resolve(true); }
  status() { return { friend: { text: "好友榜" }, global: { text: "总榜" } }; }
  submitCompletion() { return Promise.resolve(true); }
  submitClockResult() { return Promise.resolve(true); }
  openFriendBoard() { return true; }
}

const progress = new ProgressStore({ storage: new MemoryStorageAdapter() });
const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
const curated = [pipeline.build({ gridSize: "6x6", difficulty: "easy", seed: "flow-curated", sourceKind: "curated" })];
const provider = new HybridLevelProvider({ curatedLevels: curated, progress, pipeline });
const services = { progress, levelProvider: provider, renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock() };
const game = new ForestTrailMiniGame({}, curated, services);
game.renderer.controls.info = { x: 0, y: 0, width: 20, height: 20 };
game.renderer.controls.infoDismiss = { x: 30, y: 0, width: 30, height: 20 };
game.handleStart({ touches: [{ clientX: 10, clientY: 10 }] });
assert.strictEqual(game.infoVisible, true);
const beforeInfoTouchPath = game.engine.getSnapshot().path.length;
game.handleStart({ touches: [{ clientX: 200, clientY: 200 }] });
assert.strictEqual(game.engine.getSnapshot().path.length, beforeInfoTouchPath);
game.handleStart({ touches: [{ clientX: 40, clientY: 10 }] });
assert.strictEqual(game.infoVisible, false);
game.renderer.controls.theme = { x: 0, y: 30, width: 20, height: 20 };
game.renderer.controls.themeOptions = [{ x: 30, y: 30, width: 40, height: 20, id: "zhu-sha" }];
game.handleStart({ touches: [{ clientX: 10, clientY: 40 }] });
assert.strictEqual(game.themePickerVisible, true);
const beforeThemeTouchPath = game.engine.getSnapshot().path.length;
game.handleStart({ touches: [{ clientX: 200, clientY: 200 }] });
assert.strictEqual(game.engine.getSnapshot().path.length, beforeThemeTouchPath);
game.handleStart({ touches: [{ clientX: 40, clientY: 40 }] });
assert.strictEqual(game.themePickerVisible, false);
assert.strictEqual(progress.boardTheme(), "zhu-sha");
assert.strictEqual(game.view().boardTheme, "zhu-sha");
for (const cell of game.current.solution.slice(0, 5)) assert.strictEqual(game.moveTo(cell), true);
const savedPathLength = game.engine.getSnapshot().path.length;
const resumed = new ForestTrailMiniGame({}, curated, { ...services, renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock() });
assert.strictEqual(resumed.current.id, game.current.id);
assert.strictEqual(resumed.engine.getSnapshot().path.length, savedPathLength);

resumed.startDaily(new Date("2026-09-02T00:00:00Z"));
assert.strictEqual(resumed.mode, "daily");
resumed.startChallenge("challenge-fruit-1");
assert.strictEqual(resumed.mode, "challenge");
assert.strictEqual(resumed.current.gridSize, "6x6");
for (const waypoint of resumed.current.waypoints) resumed.moveTo(waypoint.cell);
assert.strictEqual(resumed.engine.getSnapshot().status, "completed");
assert.strictEqual(resumed.sound.celebrations, 1);
assert.strictEqual(resumed.renderer.effectStarts, 1);
assert.ok(resumed.renderer.completionFireworks);
resumed.nextAfterCompletion();
assert.strictEqual(resumed.challengeSelectVisible, true);
assert.strictEqual(resumed.renderer.completionFireworks, null);
resumed.startClock("hard");
assert.strictEqual(resumed.view().clockTier.bonusMs, 5000);
resumed.destroy(); game.destroy();
console.log("PASS game-flow-architecture");
