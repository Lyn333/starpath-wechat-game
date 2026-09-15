const assert = require("assert");
const { ForestTrailMiniGame } = require("../core/GameFlow");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ACTIVE_SESSION_LIMIT, ProgressStore, STORAGE_KEY, migrateState } = require("../core/ProgressStore");
const { TrailEngine } = require("../core/TrailEngine");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { neighbors, wallKey } = require("../core/puzzle/PuzzleGenerator");
const { CLOCK_TIERS, CLOCK_WAVE_SIZE, clockRequest } = require("../core/modes/ModeCatalog");
const { HybridLevelProvider } = require("../core/providers/HybridLevelProvider");
const { LeaderboardService } = require("../core/LeaderboardService");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const catalog = require("../catalog/catalogManifest.js");

class RendererMock {
  constructor() { this.controls = {}; this.completionFireworks = null; this.renders = 0; }
  setLevel(level) { this.level = level; }
  startCompletionFireworks(startedAt) { this.completionFireworks = { startedAt }; }
  clearCompletionFireworks() { this.completionFireworks = null; }
  render() { this.renders += 1; }
  hit(box, point) { return Boolean(box && point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height); }
  resize() {}
  toCell() { return null; }
  friendBoardCanvasSize() { return { width: 300, height: 400 }; }
}
class SoundMock { startBackgroundMusic() {} setEnabled() {} tap() {} coin() {} undo() {} reset() {} complete() {} playCompletionCelebration() {} destroy() {} }
class LeaderboardMock {
  constructor() { this.opened = []; this.canvas = { width: 0, height: 0 }; }
  initialize() { return Promise.resolve(true); }
  status() { return { friend: { text: "好友榜" }, global: { text: "总榜" } }; }
  submitCompletion() { return Promise.resolve(true); }
  submitClockResult() { return Promise.resolve(true); }
  openFriendBoard(options) { this.opened.push(options); return true; }
  friendBoardCanvas() { return this.canvas; }
}
const tap = (game, x, y) => game.handleStart({ touches: [{ clientX: x, clientY: y }] });
const solve = (game) => { for (const cell of game.current.solution) game.moveTo(cell); };
const createGame = (overrides = {}) => {
  const progress = overrides.progress || new ProgressStore({ storage: new MemoryStorageAdapter() });
  return new ForestTrailMiniGame({}, [], { progress, renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock(), ...overrides });
};

// 1. 精品题库必须真正接入 GameFlow，而不是被静默丢弃后全部落到 Seed 生成。
{
  const game = createGame({ catalog });
  assert.strictEqual(game.levelProvider.catalog, catalog, "GameFlow 应把 services.catalog 传给 HybridLevelProvider");
  assert.strictEqual(game.current.sourceKind, "catalog", "首关应来自精品题库");
  assert.ok(game.levelProvider.stats().curatedTotal >= 20000);
  game.destroy();
}

// 2. 换题不应让 activeSessions 无限增长；旧的未完成局在离开时被清理，且存在硬上限。
{
  const storage = new MemoryStorageAdapter();
  const progress = new ProgressStore({ storage });
  const game = createGame({ progress });
  for (let index = 0; index < 40; index += 1) game.selectStandard("6x6", "easy");
  assert.ok(progress.activeSessionCount() <= 1, `换题后不应残留旧 session，实际 ${progress.activeSessionCount()}`);
  assert.ok(JSON.stringify(storage.get(STORAGE_KEY)).length < 64 * 1024, "存档体积应保持在数十 KB 以内");
  game.destroy();
  // 直接写入超过上限时也会被裁剪，旧存档迁移同理。
  const bulk = new ProgressStore({ storage: new MemoryStorageAdapter(), now: (() => { let tick = 0; return () => (tick += 1); })() });
  for (let index = 0; index < ACTIVE_SESSION_LIMIT + 5; index += 1) bulk.saveActiveSession({ id: `level-${index}`, gridSize: "6x6", difficulty: "easy" }, { version: 1, levelId: `level-${index}`, path: [] });
  assert.strictEqual(bulk.activeSessionCount(), ACTIVE_SESSION_LIMIT);
  assert.ok(bulk.loadActiveSession(`level-${ACTIVE_SESSION_LIMIT + 4}`), "应保留最新的 session");
  assert.strictEqual(bulk.loadActiveSession("level-0"), null, "应淘汰最旧的 session");
  const migrated = migrateState({ activeSessions: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`old-${index}`, { level: {}, engineState: {}, updatedAt: index }])) });
  assert.strictEqual(Object.keys(migrated.activeSessions).length, ACTIVE_SESSION_LIMIT);
}

// 3. 通关后关闭弹窗，界面按钮必须继续可用；隐藏弹窗的按钮不能再被点中。
{
  const game = createGame();
  solve(game);
  assert.strictEqual(game.view().completionVisible, true);
  game.renderer.controls.close = { x: 0, y: 0, width: 10, height: 10 };
  game.renderer.controls.next = { x: 100, y: 100, width: 10, height: 10 };
  game.renderer.controls.difficulties = [{ id: "hard", x: 200, y: 200, width: 10, height: 10 }];
  game.renderer.controls.undo = { x: 300, y: 300, width: 10, height: 10 };
  tap(game, 5, 5);
  assert.strictEqual(game.view().completionVisible, false);
  const completedId = game.current.id;
  tap(game, 305, 305);
  assert.strictEqual(game.engine.getSnapshot().status, "completed", "通关后撤回不应改变已通关棋盘");
  tap(game, 205, 205);
  assert.strictEqual(game.difficulty, "hard", "关闭通关弹窗后难度按钮应生效");
  assert.notStrictEqual(game.current.id, completedId, "关闭通关弹窗后应能切换到新题");
  game.destroy();
  // 真实渲染器在弹窗隐藏时必须清空热区。
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const context = new Proxy({}, { get: (target, property) => (property in target ? target[property] : () => ({ addColorStop() {} })), set: (target, property, value) => { target[property] = value; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => context });
  const solution = [];
  for (let row = 0; row < 6; row += 1) for (let index = 0; index < 6; index += 1) solution.push({ row, col: row % 2 ? 5 - index : index });
  renderer.setLevel({ id: "r", gridSize: "6x6", difficulty: "easy", rows: 6, cols: 6, walls: [], solution, waypoints: [{ number: 1, cell: solution[0] }, { number: 2, cell: solution.at(-1) }] });
  const snapshot = { status: "completed", path: solution, moves: 35, nextWaypoint: 3, message: "" };
  const baseView = { mode: "standard", progressiveLevel: 1, difficulty: "easy", difficultyLabel: "简单", gridSize: "6x6", sound: true, points: 10, time: "0:10", clockActive: false, clockSetupVisible: false, clockEnded: false, clockTiers: Object.values(CLOCK_TIERS), rankings: { friend: { text: "" }, global: { text: "" } }, completion: { best: { elapsedMs: 0 }, streak: 0 } };
  renderer.render(snapshot, { ...baseView, completionVisible: true });
  assert.ok(renderer.controls.next && renderer.controls.close);
  renderer.render(snapshot, { ...baseView, completionVisible: false });
  assert.strictEqual(renderer.controls.next, undefined, "弹窗隐藏后 next 热区必须被清除");
  assert.strictEqual(renderer.controls.close, undefined);
  // 4. 时间挑战结果弹窗必须提供关闭出口。
  renderer.render(snapshot, { ...baseView, clockEnded: true, clockResult: { tier: CLOCK_TIERS.easy, current: { solved: 2, remainingMs: 0 } } });
  assert.ok(renderer.controls.clockClose, "时间挑战结果弹窗应有关闭按钮");
  // 5. 好友榜弹窗会把 sharedCanvas 贴到屏幕上。
  let drawn = null;
  context.drawImage = (image, ...rest) => { drawn = { image, rest }; };
  const shared = { width: 300, height: 400 };
  renderer.render(snapshot, { ...baseView, friendBoardVisible: true, friendBoardTitle: "好友榜", friendBoardCanvas: shared });
  assert.strictEqual(drawn?.image, shared, "主域应 drawImage 开放数据域的 sharedCanvas");
  assert.ok(renderer.controls.friendBoardClose);
  delete global.wx;
}

// 4. 时间挑战结束后可以关闭弹窗回到普通模式。
{
  const game = createGame();
  game.startClock("easy");
  game.finishClock();
  assert.strictEqual(game.mode, "clock-ended");
  game.renderer.controls.clockClose = { x: 0, y: 0, width: 10, height: 10 };
  tap(game, 5, 5);
  assert.strictEqual(game.mode, "standard");
  assert.strictEqual(game.view().clockEnded, false);
  game.destroy();
}

// 5. 点击“查看排行榜”会打开好友榜弹窗并可关闭，而不是只弹 toast。
{
  const game = createGame();
  solve(game);
  game.renderer.controls.leaderboard = { x: 0, y: 0, width: 10, height: 10 };
  tap(game, 5, 5);
  assert.strictEqual(game.view().friendBoardVisible, true);
  assert.strictEqual(game.leaderboard.opened.length, 1);
  assert.deepStrictEqual(game.leaderboard.opened[0], { clock: false, width: 300, height: 400 });
  assert.strictEqual(game.view().friendBoardCanvas, game.leaderboard.canvas);
  game.renderer.controls.next = { x: 100, y: 100, width: 10, height: 10 };
  const before = game.current.id;
  tap(game, 105, 105);
  assert.strictEqual(game.current.id, before, "好友榜打开时不应穿透点击到下层弹窗");
  game.renderer.controls.friendBoardClose = { x: 50, y: 50, width: 10, height: 10 };
  tap(game, 55, 55);
  assert.strictEqual(game.view().friendBoardVisible, false);
  assert.strictEqual(game.friendBoardTimer, null);
  game.destroy();
  // LeaderboardService 会把 sharedCanvas 尺寸同步给开放数据域。
  const posted = [];
  const sharedCanvas = { width: 0, height: 0 };
  global.wx = { getOpenDataContext: () => ({ canvas: sharedCanvas, postMessage: (message) => posted.push(message) }) };
  const service = new LeaderboardService();
  assert.strictEqual(service.openFriendBoard({ clock: true, width: 320, height: 480 }), true);
  assert.deepStrictEqual([sharedCanvas.width, sharedCanvas.height], [320, 480]);
  assert.strictEqual(posted[0].key, "forest_trail_clock_rank_score_v1");
  assert.strictEqual(service.friendBoardCanvas(), sharedCanvas);
  delete global.wx;
}

// 6. 普通模式下计时器会自动刷新，而不是只在触摸时重绘。
{
  const game = createGame();
  const rendersAtStart = game.renderer.renders;
  game.tickUi();
  assert.strictEqual(game.renderer.renders, rendersAtStart + 1);
  assert.ok(game.uiTimer, "应存在 UI 定时器");
  solve(game);
  const rendersAfterSolve = game.renderer.renders;
  game.tickUi();
  assert.strictEqual(game.renderer.renders, rendersAfterSolve, "通关后不再周期重绘");
  game.destroy();
  assert.strictEqual(game.uiTimer, null);
}

// 7. 通关后的用时应被冻结；恢复未完成局时用时应延续而不是归零。
{
  const game = createGame();
  game.startedAt = Date.now() - 65000;
  solve(game);
  const frozen = game.view().time;
  assert.strictEqual(frozen, game.view().time);
  assert.ok(game.completedAt);
  const recorded = game.completionSummary.current.elapsedMs;
  assert.ok(recorded >= 65000 && recorded < 70000);
  game.destroy();
  const storage = new MemoryStorageAdapter();
  const progress = new ProgressStore({ storage });
  const first = createGame({ progress });
  first.startedAt = Date.now() - 30000;
  for (const cell of first.current.solution.slice(0, 3)) first.moveTo(cell);
  first.destroy();
  const resumed = createGame({ progress: new ProgressStore({ storage }) });
  assert.strictEqual(resumed.current.id, first.current.id);
  assert.ok(Date.now() - resumed.startedAt >= 30000, "恢复存档时应延续已用时间");
  resumed.destroy();
}

// 8. 关卡挑战：可自由选择关卡；完成后星级按目标时间持久化，重启后保留。
{
  const storage = new MemoryStorageAdapter();
  const game = createGame({ progress: new ProgressStore({ storage }) });
  game.openChallengeSelect();
  assert.strictEqual(game.challengeSelectVisible, true);
  game.startChallenge("challenge-space-1");
  assert.strictEqual(game.mode, "challenge");
  assert.strictEqual(game.challengeSelectVisible, false);
  for (const waypoint of game.current.waypoints) game.moveTo(waypoint.cell);
  assert.strictEqual(game.engine.getSnapshot().status, "completed");
  assert.ok(game.progress.starsFor("challenge-space-1") >= 1);
  game.nextAfterCompletion();
  assert.strictEqual(game.challengeSelectVisible, true, "完成后回到关卡选择");
  game.destroy();
  const restarted = createGame({ progress: new ProgressStore({ storage }) });
  assert.ok(restarted.progress.starsFor("challenge-space-1") >= 1, "星级应持久化");
  restarted.destroy();
}

// 9. 时间挑战棋盘尺寸只随本局已解题数升级，新一局必须从档位起始尺寸开始。
{
  assert.strictEqual(clockRequest("easy", 99, 0).gridSize, "6x6");
  assert.strictEqual(clockRequest("easy", 1, CLOCK_WAVE_SIZE).gridSize, "8x8");
  assert.notStrictEqual(clockRequest("easy", 1, 0).seed, clockRequest("easy", 2, 0).seed, "ordinal 仍应让 Seed 不重复");
  const progress = new ProgressStore({ storage: new MemoryStorageAdapter() });
  const provider = new HybridLevelProvider({ progress });
  for (let index = 0; index < 6; index += 1) provider.clock("easy", 0);
  assert.strictEqual(provider.clock("easy", 0).gridSize, "6x6", "累计 ordinal 不应影响尺寸");
  const game = createGame();
  game.startClock("easy");
  const sizes = [game.current.gridSize];
  for (let index = 0; index < CLOCK_WAVE_SIZE; index += 1) { solve(game); sizes.push(game.current.gridSize); }
  assert.deepStrictEqual(sizes, ["6x6", "6x6", "6x6", "8x8"]);
  game.finishClock();
  game.startClock("easy");
  assert.strictEqual(game.current.gridSize, "6x6", "第二局应回到起始尺寸");
  game.destroy();
}

// 10. 引擎与验证器规则一致：最大数字必须是终点，覆盖全盘但未在终点结束不算通关。
{
  const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
  let counterexample = null;
  for (let seedIndex = 0; seedIndex < 400 && !counterexample; seedIndex += 1) {
    const puzzle = pipeline.build({ gridSize: "4x4", difficulty: "hard", seed: `regression-endpoint-${seedIndex}` });
    const walls = new Set(puzzle.walls);
    const numberByCell = new Map(puzzle.waypoints.map((item) => [`${item.cell.row}-${item.cell.col}`, item.number]));
    const last = puzzle.waypoints[puzzle.waypoints.length - 1].cell;
    const path = [puzzle.waypoints[0].cell];
    const seen = new Set([`${path[0].row}-${path[0].col}`]);
    const search = (expected) => {
      if (path.length === 16) { const tail = path[15]; return expected === puzzle.waypoints.length + 1 && !(tail.row === last.row && tail.col === last.col); }
      const tail = path[path.length - 1];
      for (const next of neighbors(tail, 4, 4)) {
        const key = `${next.row}-${next.col}`;
        if (seen.has(key) || walls.has(wallKey(tail, next))) continue;
        const number = numberByCell.get(key);
        if (number && number !== expected) continue;
        seen.add(key); path.push(next);
        if (search(number ? expected + 1 : expected)) return true;
        path.pop(); seen.delete(key);
      }
      return false;
    };
    if (search(2)) counterexample = { puzzle, path: path.slice() };
  }
  assert.ok(counterexample, "应能找到“经过所有数字但未在终点结束”的路径样本");
  const engine = new TrailEngine(counterexample.puzzle);
  const accepted = counterexample.path.every((cell) => engine.tryMove(cell));
  assert.strictEqual(accepted, false, "提前踩到最大数字的移动应被拒绝");
  assert.notStrictEqual(engine.getSnapshot().status, "completed");
  const replay = new TrailEngine(counterexample.puzzle);
  for (const cell of counterexample.puzzle.solution) assert.strictEqual(replay.tryMove(cell), true);
  assert.strictEqual(replay.getSnapshot().status, "completed", "标准解仍应通关");
}

console.log("PASS gameplay-regressions");
