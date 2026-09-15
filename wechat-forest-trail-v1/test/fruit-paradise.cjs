const assert = require("assert");
const {
  FRUIT_LEVELS, FRUIT_POOL, FRUIT_PREVIEW_MS, FRUIT_HIDE_MS, FRUIT_TUTORIAL_STEPS,
  dealFruitIcons, fruitGrade, fruitScoreBreakdown, fruitStars, generateFruitLayout,
  snakePath, validateFruitCoverLayout, isFruitPerfect,
} = require("../core/challenge/FruitParadise");
const { FruitParadiseEngine } = require("../core/challenge/FruitParadiseEngine");
const { CHALLENGE_LEVELS, getChallengeLevel, challengeThemeList, validateChallengeLevel } = require("../core/challenge/ChallengeLevels");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { ForestTrailMiniGame } = require("../core/GameFlow");
const { ProgressStore } = require("../core/ProgressStore");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");

function playSolution(engine, path) {
  for (const cell of path) assert.strictEqual(engine.tryMove(cell), true, `应能走到 ${cell.row},${cell.col}`);
}

{
  assert.strictEqual(FRUIT_LEVELS.length, 5);
  assert.strictEqual(FRUIT_TUTORIAL_STEPS.length, 8);
  assert.ok(FRUIT_TUTORIAL_STEPS[6].includes("到达水果 10"));
  const titles = FRUIT_LEVELS.map((level) => level.title);
  assert.deepStrictEqual(titles, ["苹果果园", "水果小径", "迷雾果林", "彩虹果园", "丰收秘境"]);
  for (const level of FRUIT_LEVELS) {
    assert.doesNotThrow(() => validateFruitCoverLayout(level), `${level.id} 应合法`);
    assert.doesNotThrow(() => validateChallengeLevel(level));
    assert.strictEqual(level.playStyle, "fruit-cover");
    assert.strictEqual(level.requireFullCoverage, true);
    assert.strictEqual(level.gridSize, "6x6");
    assert.strictEqual(level.waypoints.length, 10);
    assert.strictEqual(level.previewMs, FRUIT_PREVIEW_MS);
    assert.strictEqual(level.hidden, true);
    assert.strictEqual(level.showTargetName, false);
    assert.strictEqual(level.solution.length, 36);
    assert.strictEqual(level.waypoints[0].cell.row, 0);
    assert.strictEqual(level.waypoints[0].cell.col, 0);
  }
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").undoLimit, 3);
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").errorMode, "practice-step");
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").connectMs, 90000);
  assert.strictEqual(getChallengeLevel("challenge-fruit-3").errorMode, "practice-fruit");
  assert.strictEqual(getChallengeLevel("challenge-fruit-4").errorMode, "challenge-fail");
  assert.strictEqual(getChallengeLevel("challenge-fruit-5").undoLimit, 0);
  const path = snakePath();
  assert.deepStrictEqual(path[0], { row: 0, col: 0 });
  assert.deepStrictEqual(path[5], { row: 0, col: 5 });
  assert.deepStrictEqual(path[6], { row: 1, col: 5 });
  assert.deepStrictEqual(path[35], { row: 5, col: 0 });
}

{
  const level = getChallengeLevel("challenge-fruit-1");
  const dealt = dealFruitIcons(level, "deal-a");
  const dealt2 = dealFruitIcons(level, "deal-b");
  assert.strictEqual(dealt.waypoints.length, 10);
  assert.strictEqual(new Set(dealt.waypoints.map((item) => item.name)).size, 10);
  dealt.waypoints.forEach((waypoint, index) => {
    assert.deepStrictEqual(waypoint.cell, level.waypoints[index].cell, "随机只换图案，不改检查点坐标");
    assert.ok(FRUIT_POOL.includes(waypoint.name));
  });
  assert.notDeepStrictEqual(dealt.waypoints.map((item) => item.name), dealt2.waypoints.map((item) => item.name));
}

{
  const generated = generateFruitLayout({ seed: "gen-1" });
  assert.strictEqual(generated.waypoints.length, 10);
  const fake = {
    id: "gen", playStyle: "fruit-cover", gridSize: "6x6", rows: 6, cols: 6,
    waypoints: generated.waypoints, solution: generated.path, previewMs: 10000,
    hidden: true, memoryMode: "hidden", showTargetName: false, errorMode: "practice-step",
  };
  assert.doesNotThrow(() => validateFruitCoverLayout(fake));
}

{
  const level = getChallengeLevel("challenge-fruit-1");
  const engine = new FruitParadiseEngine(level);
  assert.strictEqual(engine.tryMove({ row: 0, col: 1 }), false, "不能从非水果1起手");
  assert.strictEqual(engine.errors, 0);
  playSolution(engine, level.solution);
  assert.strictEqual(engine.getSnapshot().status, "completed");
  assert.strictEqual(engine.getSnapshot().covered, 36);
  assert.strictEqual(engine.errors, 0);
}

{
  const level = getChallengeLevel("challenge-fruit-1");
  const engine = new FruitParadiseEngine(level);
  engine.tryMove(level.solution[0]);
  engine.tryMove(level.solution[1]);
  assert.strictEqual(engine.tryMove({ row: 0, col: 0 }), false);
  assert.ok(engine.message.includes("不能重复经过同一格"));
  assert.strictEqual(engine.errors, 1);
  assert.strictEqual(engine.getSnapshot().status, "active");
  assert.deepStrictEqual(engine.getSnapshot().path, [{ row: 0, col: 0 }], "练习模式重复走格应回退一步");
}

{
  const level = getChallengeLevel("challenge-fruit-1");
  const engine = new FruitParadiseEngine(level);
  engine.tryMove({ row: 0, col: 0 });
  engine.tryMove({ row: 0, col: 1 });
  engine.tryMove({ row: 0, col: 2 });
  engine.tryMove({ row: 0, col: 3 });
  engine.tryMove({ row: 0, col: 4 });
  const grape = level.waypoints[3].cell;
  assert.strictEqual(engine.tryMove(grape), false, "不相邻的错误水果应被忽略而不是记错");
  assert.strictEqual(engine.errors, 0);
}

{
  const level = getChallengeLevel("challenge-fruit-4");
  const engine = new FruitParadiseEngine(level);
  engine.tryMove({ row: 0, col: 0 });
  engine.tryMove({ row: 0, col: 1 });
  engine.tryMove({ row: 0, col: 2 });
  engine.tryMove({ row: 0, col: 3 });
  const orange = level.waypoints[1].cell; // fruit 2 at R1C5 = (0,4)
  engine.tryMove(orange); // this is fruit 2, OK
  const strawberry = level.waypoints[2].cell; // fruit 3 R2C5 (1,4) — adjacent? from (0,4) yes down.
  // skip fruit 3, go left to empty (0,3) which is visited -> revisit fail in challenge mode
  assert.strictEqual(engine.tryMove({ row: 0, col: 3 }), false);
  assert.strictEqual(engine.getSnapshot().status, "failed");
  assert.ok(engine.getSnapshot().failReason.includes("不能重复经过同一格"));
}

{
  const level = getChallengeLevel("challenge-fruit-4");
  const engine = new FruitParadiseEngine(level);
  engine.tryMove({ row: 0, col: 0 });
  engine.tryMove({ row: 0, col: 1 });
  engine.tryMove({ row: 0, col: 2 });
  engine.tryMove({ row: 0, col: 3 });
  // fruit 3 strawberry at (1,4) is next+1 if we haven't hit fruit 2. Next is fruit 2 at (0,4).
  // Go down to (1,3) empty then toward fruit 3 without fruit 2.
  engine.tryMove({ row: 1, col: 3 });
  assert.strictEqual(engine.tryMove(level.waypoints[2].cell), false, "跳过水果2碰到水果3应失败");
  assert.strictEqual(engine.getSnapshot().status, "failed");
  assert.ok(!engine.message.includes("草莓") && !engine.message.includes("下一个"));
}

{
  const level = getChallengeLevel("challenge-fruit-3");
  const engine = new FruitParadiseEngine(level);
  engine.tryMove({ row: 0, col: 0 });
  engine.tryMove({ row: 0, col: 1 });
  engine.tryMove({ row: 0, col: 2 });
  engine.tryMove({ row: 1, col: 2 }); // empty, then hit fruit 3 banana at (1,1) which is wrong (next is 2 at 0,3)
  assert.strictEqual(engine.tryMove(level.waypoints[2].cell), false);
  assert.strictEqual(engine.getSnapshot().status, "active");
  assert.strictEqual(engine.message, "路线中断");
  assert.deepStrictEqual(engine.getSnapshot().path[engine.getSnapshot().path.length - 1], { row: 0, col: 0 }, "应回退到上一个正确水果");
}

{
  const level = getChallengeLevel("challenge-fruit-1");
  const engine = new FruitParadiseEngine(level);
  for (const cell of level.solution.slice(0, 30)) engine.tryMove(cell); // fruit 10 at index 29
  assert.strictEqual(engine.getSnapshot().fruit10Reached, true);
  assert.notStrictEqual(engine.getSnapshot().status, "completed");
  assert.ok(engine.message.includes("终点已到达，但棋盘尚未完成"));
  for (const cell of level.solution.slice(30)) engine.tryMove(cell);
  assert.strictEqual(engine.getSnapshot().status, "completed");
}

{
  const stats = { covered: 36, errors: 0, undos: 0, elapsedMs: 40000, failed: false };
  const level = getChallengeLevel("challenge-fruit-1");
  assert.strictEqual(fruitStars(level, stats), 3);
  assert.strictEqual(isFruitPerfect(level, stats), true);
  assert.strictEqual(fruitGrade(level, { ...stats, elapsedMs: 20000 }), "S");
  const score = fruitScoreBreakdown(level, { ...stats, elapsedMs: 20000 });
  assert.strictEqual(score.base, 500);
  assert.strictEqual(score.coverBonus, 300);
  assert.strictEqual(score.noMistakeBonus, 200);
  assert.strictEqual(score.noUndoBonus, 100);
  assert.strictEqual(score.memoryBonus, 150);
  assert.ok(score.speedBonus > 0);
  assert.strictEqual(fruitStars(level, { covered: 20, errors: 0, undos: 0, elapsedMs: 1000, failed: false }), 0);
  assert.strictEqual(fruitGrade(level, { covered: 36, errors: 3, undos: 3, elapsedMs: 80000 }), "C");
}

{
  const makeGame = (rendererMock, progress) => new ForestTrailMiniGame({}, [], {
    progress: progress || new ProgressStore({ storage: new MemoryStorageAdapter() }),
    renderer: rendererMock,
    sound: new Proxy({}, { get: () => () => {} }),
    leaderboard: { initialize: () => Promise.resolve(true), status: () => ({ friend: { text: "" }, global: { text: "" } }), submitCompletion: () => Promise.resolve(true) },
  });
  const rendererMock = { setLevel() {}, render() {}, resize() {}, hit() { return false; }, toCell() { return null; }, startCompletionFireworks(startedAt, kind) { this.kind = kind; this.completionFireworks = { startedAt, kind }; }, clearCompletionFireworks() { this.completionFireworks = null; }, drawCompletionFireworks() { return false; }, controls: {}, friendBoardCanvasSize() { return {}; } };

  const game = makeGame(rendererMock);
  game.progress.markFruitTutorialSeen();
  game.startChallenge("challenge-fruit-1");
  assert.strictEqual(game.isFruitCover(), true);
  assert.ok(game.view().fruitMemory.active);
  assert.ok(game.view().fruitMemory.previewing);
  assert.strictEqual(game.view().challengeMemory, null, "水果乐园不应显示下一个水果 HUD");
  assert.ok(!JSON.stringify(game.view().fruitMemory).includes("下一个"));
  game.challengePreviewUntil = Date.now() - 1;
  game.fruitHideUntil = Date.now() - 1;
  game.fruitConnectEndsAt = Date.now() + 90000;
  game.startedAt = Date.now();
  const mem = game.view().fruitMemory;
  assert.strictEqual(mem.previewing, false);
  assert.ok(mem.hideProgress >= 1);
  for (const cell of game.current.solution) assert.strictEqual(game.moveTo(cell), true);
  assert.strictEqual(game.engine.getSnapshot().status, "completed");
  assert.strictEqual(rendererMock.kind, "harvest");
  assert.ok(game.completionSummary.fruitLesson.includes("到达水果 10"));
  assert.ok(game.completionSummary.breakdown.coverBonus >= 300);
  game.destroy();

  const firstVisit = makeGame(rendererMock, new ProgressStore({ storage: new MemoryStorageAdapter() }));
  firstVisit.startChallenge("challenge-fruit-2");
  assert.strictEqual(firstVisit.fruitTutorialVisible, true);
  assert.strictEqual(firstVisit.view().fruitMemory.phase, "tutorial");
  firstVisit.beginFruitPreview();
  assert.strictEqual(firstVisit.fruitTutorialVisible, false);
  assert.ok(firstVisit.view().fruitMemory.previewing);
  firstVisit.destroy();

  const failGame = makeGame(rendererMock);
  failGame.progress.markFruitTutorialSeen();
  failGame.startChallenge("challenge-fruit-4");
  failGame.challengePreviewUntil = Date.now() - 1;
  failGame.fruitHideUntil = Date.now() - 1;
  failGame.fruitConnectEndsAt = Date.now() + 120000;
  failGame.moveTo({ row: 0, col: 0 });
  failGame.moveTo({ row: 0, col: 1 });
  failGame.moveTo({ row: 0, col: 2 });
  failGame.moveTo({ row: 0, col: 3 });
  failGame.moveTo({ row: 1, col: 3 });
  failGame.moveTo(failGame.current.waypoints[2].cell);
  assert.strictEqual(failGame.engine.getSnapshot().status, "failed");
  assert.strictEqual(failGame.fruitFailedVisible, true);
  assert.ok(failGame.view().fruitMemory.showSolution);
  failGame.destroy();
}

{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const texts = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {}, save() {}, restore() {}, strokeText() {}, createLinearGradient() { return { addColorStop() {} }; }, measureText(v) { return { width: String(v).length * 7 }; }, fillText(v) { texts.push(String(v)); } };
  const ctx = new Proxy(target, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => ctx });
  const level = getChallengeLevel("challenge-fruit-1");
  renderer.setLevel(level);
  const snapshot = { status: "idle", path: [], nextWaypoint: 1, moves: 0, errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: 10, covered: 0, totalCells: 36 };
  renderer.drawFruitMemoryPopup(snapshot, { fruitMemory: { active: true, previewing: true, phase: "full", previewRemainingMs: 8000, hideProgress: 0 } });
  for (const label of ["水果记忆挑战", "请记住 1～10 的水果和位置", "剩余观察时间：8", "10 秒后开始盲连"]) {
    assert.ok(texts.includes(label), `弹窗缺少：${label}`);
  }
  assert.ok(texts.includes("🍎") || texts.includes(level.waypoints[0].icon));
  assert.ok(texts.includes("1"));
  texts.length = 0;
  renderer.drawBoard(snapshot, {
    boardTheme: undefined, time: "1:12", points: 0, clockActive: false,
    status: { currentWaypoint: 0, totalWaypoints: 10, errors: 0, combo: 0, bestMs: null, covered: 18, totalCells: 36 },
    fruitMemory: { active: true, previewing: false, hiding: false, phase: "play", covered: 18, totalCells: 36, connectRemainingMs: 72000, replay: false },
  });
  assert.ok(texts.some((value) => value.includes("覆盖：18 / 36")), "隐藏后应显示覆盖进度");
  assert.ok(texts.some((value) => value.includes("时间：72 秒")));
  assert.ok(!texts.some((value) => value.includes("找出") || value.includes("当前为") || value.includes("下一个")));
  assert.ok(!texts.includes("🍎"), "隐藏后主棋盘不应再画出水果");
  texts.length = 0;
  renderer.drawFruitTutorial({ fruitMemory: { tutorial: true } });
  assert.ok(texts.includes("水果乐园教学"));
  assert.ok(texts.includes("到达水果 10 还不代表立即完成，必须走完剩余格子。"));
  assert.ok(renderer.controls.fruitTutorialDismiss);
  delete global.wx;
}

{
  assert.strictEqual(CHALLENGE_LEVELS.filter((level) => level.theme === "fruit").length, 5);
  const themes = challengeThemeList();
  assert.strictEqual(themes[0].levels[0].title, "苹果果园");
}

console.log("PASS fruit-paradise");
