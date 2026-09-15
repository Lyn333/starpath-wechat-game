const assert = require("assert");
const { CHALLENGE_LEVELS, THEMES, getChallengeLevel, challengeThemeList, challengeRewardProgress, validateChallengeLevel } = require("../core/challenge/ChallengeLevels");
const { ChallengeEngine, cellsOnLine, lineCrossesBlocked } = require("../core/challenge/ChallengeEngine");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { ForestTrailMiniGame, CHALLENGE_FLASH_CYCLE_MS, CHALLENGE_FLASH_ON_MS } = require("../core/GameFlow");
const { ProgressStore } = require("../core/ProgressStore");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");

{
  assert.strictEqual(CHALLENGE_LEVELS.length, 10, "应有 10 个关卡");
  assert.strictEqual(THEMES.length, 2);
  const themes = challengeThemeList();
  for (const theme of themes) assert.strictEqual(theme.levels.length, 5, `${theme.id} 应有 5 关`);
  for (const level of CHALLENGE_LEVELS) {
    assert.doesNotThrow(() => validateChallengeLevel(level), `${level.id} 数据应合法`);
    level.waypoints.forEach((waypoint, index) => { assert.strictEqual(waypoint.number, index + 1); assert.ok(waypoint.icon, `${level.id} 图案 ${waypoint.name} 缺少图标`); });
  }
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").playStyle, "fruit-cover");
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").waypoints.length, 10);
  assert.strictEqual(getChallengeLevel("challenge-space-4").blockedCells.length, 8);
  assert.strictEqual(getChallengeLevel("challenge-space-5").blockedCells.length, 10);
  assert.strictEqual(getChallengeLevel("challenge-space-1").waypoints[0].icon, "🚀");
  assert.strictEqual(getChallengeLevel("challenge-space-3").memoryMode, "faded");
  assert.strictEqual(getChallengeLevel("challenge-space-4").memoryMode, "hidden");
  assert.strictEqual(getChallengeLevel("challenge-space-5").memoryMode, "flash");
  assert.strictEqual(getChallengeLevel("challenge-space-1").memoryMode, null);
  const rewards = challengeRewardProgress({ "challenge-fruit-1": true, "challenge-fruit-2": true }, { "challenge-fruit-1": 3, "challenge-fruit-2": 2 });
  assert.strictEqual(rewards.find((item) => item.id === "fruit").cleared, 2);
  assert.strictEqual(rewards.find((item) => item.id === "fruit").stars, 5);
  assert.strictEqual(rewards.find((item) => item.id === "fruit").complete, false);
  assert.strictEqual(rewards.find((item) => item.id === "fruit").skinId, "fruit-grove");
  assert.throws(() => validateChallengeLevel({ id: "bad", playStyle: "tap-sequence", rows: 6, cols: 6, blockedCells: [], waypoints: [{ number: 1, cell: { row: 0, col: 0 }, name: "a" }, { number: 3, cell: { row: 1, col: 1 }, name: "b" }] }));
  assert.throws(() => validateChallengeLevel({
    id: "cross", rows: 6, cols: 6, hidden: false, memoryMode: null, playStyle: "tap-sequence",
    blockedCells: [{ row: 0, col: 1 }],
    waypoints: [{ number: 1, cell: { row: 0, col: 0 }, name: "a" }, { number: 2, cell: { row: 0, col: 3 }, name: "b" }],
  }));
}

{
  const level = getChallengeLevel("challenge-space-1");
  const engine = new ChallengeEngine(level);
  const w = level.waypoints;
  assert.strictEqual(engine.getSnapshot().status, "idle");
  assert.strictEqual(engine.tryMove({ row: 0, col: 0 }), false);
  assert.strictEqual(engine.errors, 0);
  assert.strictEqual(engine.tryMove(w[1].cell), false);
  assert.strictEqual(engine.errors, 1);
  assert.strictEqual(engine.tryMove(w[0].cell), true);
  engine.undo();
  for (const waypoint of w) assert.strictEqual(engine.tryMove(waypoint.cell), true);
  assert.strictEqual(engine.getSnapshot().status, "completed");
  engine.reset();
  assert.strictEqual(engine.getSnapshot().status, "idle");
}

{
  const keys = (a, b) => cellsOnLine(a, b, a, b + 3).map((cell) => `${cell.row}-${cell.col}`);
  assert.deepStrictEqual(keys(0, 0), ["0-0", "0-1", "0-2", "0-3"]);
  assert.ok(cellsOnLine(0, 0, 2, 2).some((cell) => cell.row === 1 && cell.col === 1));
  assert.strictEqual(lineCrossesBlocked({ row: 0, col: 0 }, { row: 0, col: 3 }, new Set(["0-1"])), true);
  assert.strictEqual(lineCrossesBlocked({ row: 0, col: 0 }, { row: 0, col: 3 }, new Set(["2-2"])), false);

  const level = getChallengeLevel("challenge-space-4");
  const engine = new ChallengeEngine(level);
  const blocked = level.blockedCells[0];
  assert.strictEqual(engine.numberAt(blocked), null, "障碍格不应是图案");
  assert.strictEqual(engine.tryMove(blocked), false);
  assert.strictEqual(engine.errors, 0);

  const play = new ChallengeEngine(level);
  for (const waypoint of level.waypoints) assert.strictEqual(play.tryMove(waypoint.cell), true, `space-4 设计路径应能连接 ${waypoint.name}`);
  assert.strictEqual(play.getSnapshot().status, "completed");

  const space5 = getChallengeLevel("challenge-space-5");
  const play5 = new ChallengeEngine(space5);
  for (const waypoint of space5.waypoints) assert.strictEqual(play5.tryMove(waypoint.cell), true, `space-5 设计路径应能连接 ${waypoint.name}`);
  assert.strictEqual(play5.getSnapshot().status, "completed");

  const blockedLine = {
    id: "line-test", rows: 6, cols: 6, memoryMode: null,
    waypoints: [
      { number: 1, cell: { row: 0, col: 0 }, icon: "A", name: "a" },
      { number: 2, cell: { row: 0, col: 3 }, icon: "B", name: "b" },
    ],
    blockedCells: [{ row: 0, col: 1 }],
  };
  const crossing = new ChallengeEngine(blockedLine);
  assert.strictEqual(crossing.tryMove({ row: 0, col: 0 }), true);
  assert.strictEqual(crossing.tryMove({ row: 0, col: 3 }), false);
  assert.ok(crossing.message.includes("障碍"));
}

{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const texts = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {}, save() {}, restore() {}, strokeText() {}, createLinearGradient() { return { addColorStop() {} }; }, measureText(v) { return { width: String(v).length * 7 }; }, fillText(v) { texts.push(String(v)); } };
  const ctx = new Proxy(target, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => ctx });
  const challengeThemes = challengeThemeList().map((theme) => ({ id: theme.id, label: theme.label, icon: theme.icon, levels: theme.levels.map((level) => ({ id: level.id, index: level.index, title: level.title, gridSize: level.gridSize, stars: 0, bestMs: null })) }));
  renderer.drawChallengeSelect({ challengeThemes });
  assert.strictEqual(renderer.controls.challengeLevels.length, 10, "应登记 10 个关卡热区");
  assert.strictEqual(renderer.controls.challengeLevels[0].id, "challenge-fruit-1");
  for (const label of ["关卡挑战", "🍎 水果乐园", "🚀 太空旅行", "第1关 · 苹果果园", "第5关 · 穿越星云"]) assert.ok(texts.includes(label), `弹窗缺少文案：${label}`);
  const level = getChallengeLevel("challenge-space-4");
  renderer.setLevel(level);
  texts.length = 0;
  const snapshot = { status: "idle", path: [], nextWaypoint: 1, moves: 0, errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: level.waypoints.length };
  const view = { boardTheme: undefined, time: "0:00", points: 0, clockActive: false, status: { currentWaypoint: 0, totalWaypoints: level.waypoints.length, errors: 0, combo: 0, bestMs: null } };
  assert.doesNotThrow(() => renderer.drawBoard(snapshot, view));
  assert.ok(texts.includes("🚀"), "棋盘应绘制火箭图标");
  delete global.wx;
}

{
  const makeGame = (rendererMock) => new ForestTrailMiniGame({}, [], {
    progress: new ProgressStore({ storage: new MemoryStorageAdapter() }),
    renderer: rendererMock,
    sound: new Proxy({}, { get: () => () => {} }),
    leaderboard: { initialize: () => Promise.resolve(true), status: () => ({ friend: { text: "" }, global: { text: "" } }), submitCompletion: () => Promise.resolve(true) },
  });
  const rendererMock = { setLevel() {}, render() {}, resize() {}, hit() { return false; }, toCell() { return null; }, startCompletionFireworks() { this.completionFireworks = {}; }, clearCompletionFireworks() { this.completionFireworks = null; }, drawCompletionFireworks() { return false; }, controls: {}, friendBoardCanvasSize() { return {}; } };

  const game = makeGame(rendererMock);
  game.startChallenge("challenge-space-3");
  assert.strictEqual(game.challengePreviewActive(), true);
  let mem = game.view().challengeMemory;
  assert.ok(mem && mem.active && mem.previewRemainingMs > 0 && mem.hidden === false);
  game.challengePreviewUntil = Date.now() - 1;
  mem = game.view().challengeMemory;
  assert.strictEqual(mem.hidden, true);
  assert.strictEqual(mem.mode, "faded");
  game.moveTo(game.current.waypoints[0].cell);
  game.moveTo(game.current.waypoints[2].cell);
  assert.ok(game.challengeRevealUntil > Date.now());
  game.destroy();

  const g2 = makeGame(rendererMock);
  g2.startChallenge("challenge-space-5");
  g2.challengePreviewUntil = Date.now() - 1;
  assert.strictEqual(g2.view().challengeMemory.mode, "flash");
  assert.strictEqual(g2.view().challengeMemory.flashVisible, true);
  g2.challengePreviewUntil = Date.now() - (CHALLENGE_FLASH_ON_MS + 20);
  assert.strictEqual(g2.view().challengeMemory.flashVisible, false);
  assert.ok(CHALLENGE_FLASH_CYCLE_MS > CHALLENGE_FLASH_ON_MS);
  g2.destroy();

  const hiddenLevel = makeGame(rendererMock);
  hiddenLevel.startChallenge("challenge-space-4");
  hiddenLevel.challengePreviewUntil = Date.now() - 1;
  assert.strictEqual(hiddenLevel.view().challengeMemory.mode, "hidden");
  hiddenLevel.destroy();

  const g3 = makeGame(rendererMock);
  g3.startChallenge("challenge-space-1");
  assert.strictEqual(g3.challengePreviewActive(), false);
  assert.strictEqual(g3.view().challengeMemory, null);
  g3.destroy();
}

{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const texts = [];
  const alphas = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {}, save() {}, restore() {}, strokeText() {}, createLinearGradient() { return { addColorStop() {} }; }, measureText(v) { return { width: String(v).length * 7 }; }, fillText(v) { texts.push(String(v)); alphas.push(this.globalAlpha == null ? 1 : this.globalAlpha); } };
  const ctx = new Proxy(target, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => ctx });
  const { FADED_ICON_ALPHA } = require("../core/SingleBoardRenderer");
  const level = getChallengeLevel("challenge-space-3");
  renderer.setLevel(level);
  const snapshot = { status: "active", path: [level.waypoints[0].cell], nextWaypoint: 2, moves: 0, errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: level.waypoints.length };
  const fadedView = { boardTheme: undefined, time: "0:10", points: 0, clockActive: false, status: { currentWaypoint: 1, totalWaypoints: level.waypoints.length, errors: 0, combo: 0, bestMs: null }, challengeMemory: { active: true, hidden: true, mode: "faded", faded: true, flashVisible: false, previewRemainingMs: 0, revealing: false, currentIcon: level.waypoints[1].icon, currentName: level.waypoints[1].name, showName: false } };
  renderer.drawBoard(snapshot, fadedView);
  assert.ok(texts.includes(level.waypoints[0].icon), "已点选图案应显示");
  const nextIcon = level.waypoints[1].icon;
  const nextAt = texts.indexOf(nextIcon);
  assert.ok(nextAt >= 0, "淡影时应绘制未点选图案");
  assert.strictEqual(alphas[nextAt], FADED_ICON_ALPHA);
  texts.length = 0;
  const flashLevel = getChallengeLevel("challenge-space-5");
  renderer.setLevel(flashLevel);
  const flashSnap = { status: "idle", path: [], nextWaypoint: 1, moves: 0, errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: flashLevel.waypoints.length };
  renderer.drawBoard(flashSnap, { boardTheme: undefined, time: "0:10", points: 0, clockActive: false, status: { currentWaypoint: 0, totalWaypoints: flashLevel.waypoints.length, errors: 0, combo: 0, bestMs: null }, challengeMemory: { active: true, hidden: true, mode: "flash", faded: false, flashVisible: false, previewRemainingMs: 0, revealing: false, currentIcon: "🚀", currentName: "火箭", showName: false } });
  assert.ok(!texts.includes("🚀"), "闪现关闭时不应泄露未点选图案");
  delete global.wx;
}

{
  const makeGame = (rendererMock, progress) => new ForestTrailMiniGame({}, [], {
    progress: progress || new ProgressStore({ storage: new MemoryStorageAdapter() }),
    renderer: rendererMock,
    sound: new Proxy({}, { get: () => () => {} }),
    leaderboard: { initialize: () => Promise.resolve(true), status: () => ({ friend: { text: "" }, global: { text: "" } }), submitCompletion: () => Promise.resolve(true) },
  });
  const rendererMock = { setLevel() {}, render() {}, resize() {}, hit() { return false; }, toCell() { return null; }, startCompletionFireworks(startedAt, kind) { this.kind = kind; this.completionFireworks = { startedAt, kind }; }, clearCompletionFireworks() { this.completionFireworks = null; }, drawCompletionFireworks() { return false; }, controls: {}, friendBoardCanvasSize() { return {}; } };

  const space = makeGame(rendererMock);
  space.startChallenge("challenge-space-1");
  space.startedAt = Date.now() - 1000;
  for (const waypoint of space.current.waypoints) space.moveTo(waypoint.cell);
  assert.strictEqual(rendererMock.kind, "nebula", "太空关通关应播放星云特效");
  space.destroy();

  const memory = makeGame(rendererMock);
  memory.startChallenge("challenge-space-3");
  memory.challengePreviewUntil = Date.now() - 1;
  memory.startedAt = Date.now() - 2000;
  for (const waypoint of memory.current.waypoints) memory.moveTo(waypoint.cell);
  assert.ok(memory.progress.achievementState().stats.memoryClears >= 1);
  assert.strictEqual(memory.progress.achievementState().stats.memoryClearsByMode.faded, 1);
  memory.destroy();

  const storage = new MemoryStorageAdapter();
  const progress = new ProgressStore({ storage });
  assert.strictEqual(progress.isBoardThemeUnlocked("fruit-grove"), false);
  for (const id of ["challenge-fruit-1", "challenge-fruit-2", "challenge-fruit-3", "challenge-fruit-4", "challenge-fruit-5"]) {
    const level = getChallengeLevel(id);
    progress.markComplete(level, { moves: 36, elapsedMs: 1000, errors: 0, undos: 0, hints: 0, stars: 3, mode: "challenge" });
  }
  assert.strictEqual(progress.challengeProgress().find((item) => item.id === "fruit").complete, true);
  assert.strictEqual(progress.isBoardThemeUnlocked("fruit-grove"), true);
  assert.strictEqual(progress.isBoardThemeUnlocked("harvest-realm"), true);
  assert.strictEqual(progress.isBoardThemeUnlocked("rainbow-fruit"), true);
  assert.strictEqual(progress.setBoardTheme("fruit-grove"), true);
  assert.strictEqual(progress.achievementState().unlocked["fruit-harvest"]?.tier, "silver");
  assert.strictEqual(progress.isBoardThemeUnlocked("nebula-night"), false);
}

console.log("PASS challenge");
