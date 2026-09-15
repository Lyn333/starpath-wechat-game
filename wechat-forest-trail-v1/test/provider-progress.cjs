const assert = require("assert");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ProgressStore, STATE_VERSION, STORAGE_KEY } = require("../core/ProgressStore");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { HybridLevelProvider } = require("../core/providers/HybridLevelProvider");

const legacy = { version: 1, completed: {}, best: {}, daily: {}, continuations: {}, clock: { best: {}, ordinals: {} }, soundEnabled: false, streak: { count: 2, lastDate: "2026-09-01" } };
const storage = new MemoryStorageAdapter({ [STORAGE_KEY]: legacy });
const progress = new ProgressStore({ storage, now: () => Date.UTC(2026, 8, 2, 6) });
assert.strictEqual(progress.getStateSnapshot().version, STATE_VERSION);
assert.strictEqual(progress.soundEnabled(), false);
assert.strictEqual(progress.boardTheme(), "tai-bai");
assert.strictEqual(progress.setBoardTheme("zhu-sha"), true);
assert.strictEqual(progress.boardTheme(), "zhu-sha");
assert.strictEqual(progress.setBoardTheme("invalid-theme"), false);
assert.strictEqual(new ProgressStore({ storage }).boardTheme(), "zhu-sha");
const legacyForest = new ProgressStore({ storage: new MemoryStorageAdapter({ [STORAGE_KEY]: { version: 2, boardTheme: "forest" } }) });
assert.strictEqual(legacyForest.boardTheme(), "tai-bai");
const legacyCloudDancer = new ProgressStore({ storage: new MemoryStorageAdapter({ [STORAGE_KEY]: { version: 4, boardTheme: "cloud-dancer" } }) });
assert.strictEqual(legacyCloudDancer.boardTheme(), "tai-bai");
const legacyWhiteGreen = new ProgressStore({ storage: new MemoryStorageAdapter({ [STORAGE_KEY]: { version: 4, boardTheme: "pure-white-green" } }) });
assert.strictEqual(legacyWhiteGreen.boardTheme(), "tai-bai");
const legacyDulux = new ProgressStore({ storage: new MemoryStorageAdapter({ [STORAGE_KEY]: { version: 6, boardTheme: "dulux-70yy-83-037" } }) });
assert.strictEqual(legacyDulux.boardTheme(), "tai-bai");
const legacyPantone = new ProgressStore({ storage: new MemoryStorageAdapter({ [STORAGE_KEY]: { version: 6, boardTheme: "pantone-264-u" } }) });
assert.strictEqual(legacyPantone.boardTheme(), "tai-bai");
assert.strictEqual(new ProgressStore({ storage: new MemoryStorageAdapter() }).boardTheme(), "tai-bai");
assert.strictEqual(progress.skillProfile().rating, 500);

const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
const curated = [
  pipeline.build({ gridSize: "6x6", difficulty: "easy", seed: "curated-a", sourceKind: "curated" }),
  pipeline.build({ gridSize: "6x6", difficulty: "easy", seed: "curated-b", sourceKind: "curated" }),
];
const provider = new HybridLevelProvider({ curatedLevels: curated, progress, pipeline });
const first = provider.nextUnlimited({ gridSize: "6x6", difficulty: "easy" });
const second = provider.nextUnlimited({ gridSize: "6x6", difficulty: "easy", excludeId: first.id });
assert.notStrictEqual(first.id, second.id);
assert.strictEqual(provider.stats().curatedTotal, 2);

const before = progress.skillProfile();
progress.markComplete(first, { moves: 35, elapsedMs: 60000, undos: 1, hints: 0 });
const after = progress.skillProfile();
assert.strictEqual(after.games, before.games + 1);
assert.strictEqual(after.wins, before.wins + 1);
assert.strictEqual(progress.wasRecentlyPlayed(first.id), true);

const dailyA = provider.daily(new Date("2026-09-02T00:00:00Z"));
const dailyB = provider.daily(new Date("2026-09-02T12:00:00Z"));
assert.strictEqual(dailyA.id, dailyB.id);
assert.strictEqual(dailyA.challengeDate, "2026-09-02");
const challenge = provider.challenge("challenge-fruit-1");
assert.strictEqual(challenge.gridSize, "6x6");
assert.strictEqual(challenge.waypoints.length, 10);
assert.strictEqual(challenge.playStyle, "fruit-cover");
assert.deepStrictEqual(challenge.waypoints[0].cell, { row: 0, col: 0 });
assert.throws(() => provider.challenge("challenge-unknown"));
const clock = provider.clock("easy");
assert.strictEqual(clock.bonusMs, 10000);
console.log("PASS provider-progress");
