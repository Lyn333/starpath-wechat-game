const assert = require("assert");
const { CHALLENGE_LEVELS, THEMES, getChallengeLevel, challengeThemeList, validateChallengeLevel } = require("../core/challenge/ChallengeLevels");
const { ChallengeEngine } = require("../core/challenge/ChallengeEngine");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");

// 1. 关卡数据完整性：两套主题各 5 关；编号、坐标、障碍全部合法且互不重叠。
{
  assert.strictEqual(CHALLENGE_LEVELS.length, 10, "应有 10 个关卡");
  assert.strictEqual(THEMES.length, 2);
  const themes = challengeThemeList();
  for (const theme of themes) assert.strictEqual(theme.levels.length, 5, `${theme.id} 应有 5 关`);
  for (const level of CHALLENGE_LEVELS) {
    assert.doesNotThrow(() => validateChallengeLevel(level), `${level.id} 数据应合法`);
    assert.strictEqual(level.requireFullCoverage, false, "关卡挑战不要求覆盖全盘");
    assert.ok(level.targetMs > level.threeStarMs, `${level.id} 目标时间应大于三星时间`);
    level.waypoints.forEach((waypoint, index) => { assert.strictEqual(waypoint.number, index + 1); assert.ok(waypoint.icon, `${level.id} 图案 ${waypoint.name} 缺少图标`); });
  }
  // 文档关键数值抽查。
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").waypoints.length, 8);
  assert.strictEqual(getChallengeLevel("challenge-fruit-5").waypoints.length, 18);
  assert.strictEqual(getChallengeLevel("challenge-space-4").blockedCells.length, 8);
  assert.strictEqual(getChallengeLevel("challenge-space-5").blockedCells.length, 10);
  assert.strictEqual(getChallengeLevel("challenge-fruit-1").waypoints[0].icon, "🍎");
  assert.strictEqual(getChallengeLevel("challenge-space-1").waypoints[0].icon, "🚀");
  // 校验函数应能抓出错误数据。
  assert.throws(() => validateChallengeLevel({ id: "bad", rows: 6, cols: 6, blockedCells: [], waypoints: [{ number: 1, cell: { row: 0, col: 0 }, name: "a" }, { number: 3, cell: { row: 1, col: 1 }, name: "b" }] }));
}

// 2. 关卡挑战引擎：按顺序点选前进；错序 / 重复点选记错误；点空格忽略；完成、撤回、重置。
{
  const level = getChallengeLevel("challenge-fruit-1");
  const engine = new ChallengeEngine(level);
  const w = level.waypoints;
  assert.strictEqual(engine.getSnapshot().status, "idle");
  assert.strictEqual(engine.getSnapshot().totalWaypoints, 8);
  assert.strictEqual(engine.nextWaypoint, 1);

  // 点空格：忽略、不计错误。
  assert.strictEqual(engine.tryMove({ row: 5, col: 5 }), false);
  assert.strictEqual(engine.errors, 0);

  // 错序：点第 2 个图案，记错误、不前进。
  assert.strictEqual(engine.tryMove(w[1].cell), false);
  assert.strictEqual(engine.errors, 1);
  assert.strictEqual(engine.nextWaypoint, 1);

  // 正确点第 1 个。
  assert.strictEqual(engine.tryMove(w[0].cell), true);
  assert.strictEqual(engine.getSnapshot().status, "active");
  assert.strictEqual(engine.nextWaypoint, 2);
  assert.strictEqual(engine.getSnapshot().path.length, 1);

  // 重复点已连接的图案：记错误。
  const errorsBefore = engine.errors;
  assert.strictEqual(engine.tryMove(w[0].cell), false);
  assert.strictEqual(engine.errors, errorsBefore + 1);

  // 撤回一步后重新点选。
  engine.undo();
  assert.strictEqual(engine.nextWaypoint, 1);
  assert.strictEqual(engine.getSnapshot().status, "idle");

  // 依次点完全部图案 -> 完成。
  for (const waypoint of w) assert.strictEqual(engine.tryMove(waypoint.cell), true);
  assert.strictEqual(engine.getSnapshot().status, "completed");
  assert.strictEqual(engine.nextWaypoint, 9);
  // 完成后不再接受点选。
  assert.strictEqual(engine.tryMove(w[0].cell), false);

  engine.reset();
  assert.strictEqual(engine.getSnapshot().status, "idle");
  assert.strictEqual(engine.errors, 0);
  assert.strictEqual(engine.getSnapshot().path.length, 0);
}

// 3. 障碍格不是图案：点障碍格被忽略，不计错误。
{
  const level = getChallengeLevel("challenge-space-4");
  const engine = new ChallengeEngine(level);
  const blocked = level.blockedCells[0];
  assert.strictEqual(engine.numberAt(blocked), null, "障碍格不应是图案");
  assert.strictEqual(engine.tryMove(blocked), false);
  assert.strictEqual(engine.errors, 0);
}

// 4. 渲染器：关卡选择弹窗登记 10 个关卡热区与关闭按钮；棋盘按图标绘制、障碍格不报错。
{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const texts = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {}, strokeText() {}, createLinearGradient() { return { addColorStop() {} }; }, measureText(v) { return { width: String(v).length * 7 }; }, fillText(v) { texts.push(String(v)); } };
  const ctx = new Proxy(target, { get: (o, p) => (p in o ? o[p] : () => {}), set: (o, p, v) => { o[p] = v; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => ctx });

  // 关卡选择弹窗。
  const challengeThemes = challengeThemeList().map((theme) => ({ id: theme.id, label: theme.label, icon: theme.icon, levels: theme.levels.map((level) => ({ id: level.id, index: level.index, title: level.title, gridSize: level.gridSize, stars: 0, bestMs: null })) }));
  renderer.drawChallengeSelect({ challengeThemes });
  assert.strictEqual(renderer.controls.challengeLevels.length, 10, "应登记 10 个关卡热区");
  assert.ok(renderer.controls.challengeClose, "应有关闭按钮热区");
  assert.strictEqual(renderer.controls.challengeLevels[0].id, "challenge-fruit-1");
  for (const label of ["关卡挑战", "🍎 水果乐园", "🚀 太空旅行", "第1关 · 果园起步", "第5关 · 穿越星云"]) assert.ok(texts.includes(label), `弹窗缺少文案：${label}`);

  // 棋盘按图标绘制（含障碍格的关卡不应报错）。
  const level = getChallengeLevel("challenge-space-4");
  renderer.setLevel(level);
  texts.length = 0;
  const snapshot = { status: "idle", path: [], nextWaypoint: 1, moves: 0, errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: level.waypoints.length };
  const view = { boardTheme: undefined, time: "0:00", points: 0, clockActive: false, status: { currentWaypoint: 0, totalWaypoints: level.waypoints.length, errors: 0, combo: 0, bestMs: null } };
  assert.doesNotThrow(() => renderer.drawBoard(snapshot, view));
  assert.ok(texts.includes("🚀"), "棋盘应绘制火箭图标");
  delete global.wx;
}

console.log("PASS challenge");
