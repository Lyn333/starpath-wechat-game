const assert = require("assert");
const { ForestTrailMiniGame } = require("../core/GameFlow");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ProgressStore, STATE_VERSION, STORAGE_KEY, migrateState } = require("../core/ProgressStore");
const { TrailEngine } = require("../core/TrailEngine");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { CLOCK_TIERS } = require("../core/modes/ModeCatalog");
const {
  HINT_PENALTY, MIN_SCORE, NO_MISTAKE_BONUS, UNDO_PENALTY, WIN_STREAK_BONUSES,
  baseScore, completionLabels, liveScore, parTimeMs, scoreBreakdown, starsFor, winStreakBonus,
} = require("../core/scoring/ScoreSystem");
const { DAILY_FREE_HINTS, MAX_STORED_HINTS, PERFECT_CLEAR_REWARD, canUseHint, consumeHint, hintTierFor, normalizeHintWallet, planHint, rewardHints } = require("../core/scoring/HintPolicy");

const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
const level = pipeline.build({ gridSize: "6x6", difficulty: "easy", seed: "scoring-fixture" });

// 1. 评分公式：基础分 = 格数 × 倍率；速度、无错、连击、连胜按文档加分；提示/撤回/错误扣分；有下限。
assert.strictEqual(baseScore(level), 36 * 10);
assert.strictEqual(parTimeMs(level), 36 * 2.5 * 1000);
const perfect = scoreBreakdown(level, { elapsedMs: 30000, errors: 0, undos: 0, hints: 0, maxCombo: 35, winStreak: 1 });
assert.strictEqual(perfect.speedBonus, Math.round((90000 - 30000) / 1000 * 2));
assert.strictEqual(perfect.noMistakeBonus, NO_MISTAKE_BONUS);
assert.strictEqual(perfect.comboBonus, 350);
assert.strictEqual(perfect.streakBonus, 0);
assert.strictEqual(perfect.total, 360 + 120 + 100 + 350);
const sloppy = scoreBreakdown(level, { elapsedMs: 200000, errors: 3, undos: 2, hints: 1, maxCombo: 4, winStreak: 0 });
assert.strictEqual(sloppy.speedBonus, 0); assert.strictEqual(sloppy.noMistakeBonus, 0);
assert.strictEqual(sloppy.hintPenalty, HINT_PENALTY); assert.strictEqual(sloppy.undoPenalty, UNDO_PENALTY * 2); assert.strictEqual(sloppy.errorPenalty, 15);
assert.strictEqual(sloppy.total, 360 + 40 - 30 - 20 - 15);
assert.strictEqual(scoreBreakdown({ rows: 4, cols: 4, difficulty: "easy" }, { elapsedMs: 999999, errors: 40, hints: 5 }).total, MIN_SCORE, "总分不应低于下限");
assert.deepStrictEqual([0, 1, 2, 3, 4, 9].map(winStreakBonus), [0, 0, WIN_STREAK_BONUSES[0], WIN_STREAK_BONUSES[1], WIN_STREAK_BONUSES[2], WIN_STREAK_BONUSES[2]]);

// 2. 星级：三星 = 达标时间 + 零错误 + 无提示；一星 = 撤回≥3 或提示≥2；其余二星。标签随之变化。
assert.strictEqual(starsFor(level, { elapsedMs: 30000, errors: 0, hints: 0, undos: 0 }), 3);
assert.strictEqual(starsFor(level, { elapsedMs: 30000, errors: 1, hints: 0, undos: 0 }), 2);
assert.strictEqual(starsFor(level, { elapsedMs: 120000, errors: 0, hints: 0, undos: 0 }), 2, "超时不能三星");
assert.strictEqual(starsFor(level, { elapsedMs: 30000, errors: 0, hints: 2, undos: 0 }), 1);
assert.strictEqual(starsFor(level, { elapsedMs: 30000, errors: 0, hints: 0, undos: 3 }), 1);
assert.deepStrictEqual(completionLabels(level, { elapsedMs: 30000, errors: 0, hints: 0, undos: 0, maxCombo: 35 }), ["Perfect", "Combo ×35"]);
assert.deepStrictEqual(completionLabels(level, { elapsedMs: 30000, errors: 1, hints: 0, undos: 0, maxCombo: 3 }), ["Great", "Fast"]);
assert.deepStrictEqual(completionLabels(level, { elapsedMs: 120000, errors: 0, hints: 0, undos: 0, maxCombo: 2 }), ["No Mistake"]);
assert.ok(liveScore(level, { maxCombo: 3 }, 18) > 0 && liveScore(level, { maxCombo: 3 }, 18) < baseScore(level), "进行中的分数按进度折算");

// 3. 引擎统计：错误、连击、被拒格；撤回/踩回清零连击；存档保留错误数。
{
  const engine = new TrailEngine(level);
  const [first, second, third] = level.solution;
  assert.strictEqual(engine.tryMove(second), false, "不从 1 出发算错误");
  assert.strictEqual(engine.getSnapshot().errors, 1);
  assert.deepStrictEqual(engine.getSnapshot().lastRejectedCell, second);
  assert.strictEqual(engine.tryMove(first), true);
  assert.strictEqual(engine.tryMove(second), true);
  assert.strictEqual(engine.tryMove(third), true);
  assert.strictEqual(engine.getSnapshot().combo, 2);
  assert.strictEqual(engine.getSnapshot().lastRejectedCell, null);
  // 沿标准解前进，直到路径末端有一个“已走过且不是上一步”的相邻格，用它触发重踏错误。
  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  let revisit = null;
  for (let index = 3; index < level.solution.length && !revisit; index += 1) {
    assert.strictEqual(engine.tryMove(level.solution[index]), true);
    revisit = level.solution.slice(0, index - 1).find((cell) => adjacent(cell, level.solution[index])) || null;
  }
  assert.ok(revisit, "标准解中应存在可触发重踏的位置");
  const comboBefore = engine.getSnapshot().combo;
  assert.strictEqual(engine.tryMove(revisit), false, "重踏算错误");
  assert.strictEqual(engine.getSnapshot().errors, 2);
  assert.strictEqual(engine.getSnapshot().combo, 0, "错误清零连击");
  assert.strictEqual(engine.getSnapshot().maxCombo, comboBefore, "最高连击保留");
  assert.strictEqual(engine.tryMove({ row: 99, col: 99 }), false);
  assert.strictEqual(engine.getSnapshot().errors, 2, "越界与非相邻滑动不计错误");
  engine.undo();
  assert.strictEqual(engine.getSnapshot().combo, 0);
  const restored = new TrailEngine(level);
  assert.strictEqual(restored.restoreState(engine.serializeState()), true);
  assert.strictEqual(restored.getSnapshot().errors, 2);
  assert.strictEqual(restored.getSnapshot().maxCombo, comboBefore);
  assert.strictEqual(engine.getSnapshot().totalWaypoints, level.waypoints.length);
}

// 4. 提示策略：每日免费 3 次、上限 9、不覆盖已积攒；三级递进；planHint 给出正确目标。
{
  assert.deepStrictEqual(normalizeHintWallet(null, "2026-09-10"), { remaining: DAILY_FREE_HINTS, lastRefillDate: "2026-09-10" });
  assert.deepStrictEqual(normalizeHintWallet({ remaining: 1, lastRefillDate: "2026-09-10" }, "2026-09-10"), { remaining: 1, lastRefillDate: "2026-09-10" }, "同一天不重复补给");
  assert.strictEqual(normalizeHintWallet({ remaining: 1, lastRefillDate: "2026-09-09" }, "2026-09-10").remaining, DAILY_FREE_HINTS);
  assert.strictEqual(normalizeHintWallet({ remaining: 7, lastRefillDate: "2026-09-09" }, "2026-09-10").remaining, 7, "已积攒更多时不降低");
  assert.strictEqual(rewardHints({ remaining: 8 }, 5).remaining, MAX_STORED_HINTS);
  assert.strictEqual(consumeHint({ remaining: 0 }).remaining, 0);
  assert.strictEqual(canUseHint({ remaining: 0 }), false);
  assert.deepStrictEqual([0, 1, 2, 5].map(hintTierFor), ["light", "path", "auto", "auto"]);
  const light = planHint(level, [], "light");
  assert.strictEqual(light.nextNumber, 1); assert.deepStrictEqual(light.cells, [level.waypoints[0].cell]);
  const path = planHint(level, level.solution.slice(0, 2), "path");
  assert.deepStrictEqual(path.cells, level.solution.slice(2, 6));
  const auto = planHint(level, level.solution.slice(0, 1), "auto");
  assert.strictEqual(auto.nextNumber, 2);
  assert.deepStrictEqual(auto.autoMoves.at(-1), level.waypoints[1].cell, "自动连接应止于下一个数字");
  assert.strictEqual(planHint(level, level.solution, "light"), null, "已走完无提示");
}

// 5. ProgressStore：提示钱包落盘与日期补给；星级/记录/连胜；v6 存档迁移。
{
  let clock = new Date("2026-09-10T02:00:00Z").getTime();
  const storage = new MemoryStorageAdapter();
  const progress = new ProgressStore({ storage, now: () => clock });
  assert.strictEqual(progress.hintsRemaining(), DAILY_FREE_HINTS);
  assert.strictEqual(progress.consumeHint(), true);
  assert.strictEqual(progress.hintsRemaining(), DAILY_FREE_HINTS - 1);
  assert.strictEqual(new ProgressStore({ storage, now: () => clock }).hintsRemaining(), DAILY_FREE_HINTS - 1, "消耗应持久化");
  clock += 86400000;
  assert.strictEqual(progress.hintsRemaining(), DAILY_FREE_HINTS, "次日补足");
  progress.rewardHints(PERFECT_CLEAR_REWARD);
  assert.strictEqual(progress.hintsRemaining(), DAILY_FREE_HINTS + 1);
  const summary = progress.markComplete(level, { moves: 35, elapsedMs: 30000, errors: 0, undos: 0, hints: 0, maxCombo: 35, points: 900, stars: 3 });
  assert.strictEqual(summary.stars, 3); assert.strictEqual(summary.winStreak, 1);
  assert.strictEqual(progress.records().fastestMs, 30000);
  assert.strictEqual(progress.records().fewestErrors, 0);
  assert.strictEqual(progress.records().bySize["6x6"].bestScore, 900);
  assert.strictEqual(progress.totalStars(), 3);
  progress.markComplete(level, { moves: 35, elapsedMs: 50000, errors: 2, undos: 0, hints: 0, maxCombo: 10, points: 500, stars: 2 });
  assert.strictEqual(progress.starsFor(level.id), 3, "星级只升不降");
  assert.strictEqual(progress.state.best[level.id].points, 900, "分数更高的成绩才是最佳");
  assert.strictEqual(progress.winStreak(), 2);
  assert.strictEqual(progress.records().longestWinStreak, 2);
  progress.breakWinStreak();
  assert.strictEqual(progress.winStreak(), 0);
  assert.strictEqual(progress.records().longestWinStreak, 2, "最长连胜不受中断影响");
  const legacy = migrateState({ version: 6, completed: { a: { completedAt: 1 } }, best: { a: { moves: 35, elapsedMs: 1000 } } });
  assert.deepStrictEqual(legacy.hints, { remaining: 0, lastRefillDate: null });
  assert.deepStrictEqual(legacy.stars, {}); assert.strictEqual(legacy.winStreak, 0);
  assert.strictEqual(legacy.records.fastestMs, null);
  assert.strictEqual(JSON.parse(JSON.stringify(storage.get(STORAGE_KEY))).version, STATE_VERSION);
}

// 6. GameFlow 集成：结算写入分数/星级/标签；三星奖励提示；提示按钮三级递进并消耗次数；错误反馈与连击提示。
class RendererMock { constructor() { this.controls = {}; this.renders = 0; } setLevel() {} render(snapshot, view) { this.renders += 1; this.lastView = view; } hit(box, point) { return Boolean(box && point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height); } resize() {} toCell() { return null; } startCompletionFireworks() {} clearCompletionFireworks() {} }
class SoundMock { constructor() { this.coins = 0; } startBackgroundMusic() {} setEnabled() {} tap() {} coin() { this.coins += 1; } undo() {} reset() {} complete() {} playCompletionCelebration() {} destroy() {} }
class LeaderboardMock { initialize() { return Promise.resolve(true); } status() { return { friend: { text: "" }, global: { text: "" } }; } submitCompletion() { return Promise.resolve(true); } submitClockResult() { return Promise.resolve(true); } openFriendBoard() { return true; } }
const createGame = (progress = new ProgressStore({ storage: new MemoryStorageAdapter() })) => new ForestTrailMiniGame({}, [], { progress, renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock(), weatherEnabled: false });
{
  const game = createGame();
  const hintsBefore = game.progress.hintsRemaining();
  assert.strictEqual(game.view().status.hintsRemaining, hintsBefore);
  assert.strictEqual(game.view().status.currentWaypoint, 0);
  // 走错一步：错误反馈 + 状态条错误数。
  const wrong = game.current.solution[1];
  assert.strictEqual(game.moveTo(wrong), false);
  assert.strictEqual(game.view().feedback?.kind, "error");
  assert.deepStrictEqual(game.view().feedback.cell, wrong);
  assert.strictEqual(game.view().status.errors, 1);
  // 轻提示 → 路径提示 → 自动连接。
  assert.strictEqual(game.useHint(), true);
  assert.strictEqual(game.hintCount, 1);
  assert.deepStrictEqual(game.view().hintCells, [game.current.waypoints[0].cell]);
  assert.strictEqual(game.progress.hintsRemaining(), hintsBefore - 1);
  assert.strictEqual(game.moveTo(game.current.solution[0]), true);
  assert.deepStrictEqual(game.view().hintCells, [], "落子后提示高亮清除");
  assert.strictEqual(game.useHint(), true);
  assert.strictEqual(game.view().hintCells.length, 4, "第二次为 4 步路径提示");
  const pathBefore = game.engine.getSnapshot().path.length;
  assert.strictEqual(game.useHint(), true);
  assert.ok(game.engine.getSnapshot().path.length > pathBefore, "第三次自动连接推进路径");
  assert.deepStrictEqual(game.engine.getSnapshot().path.at(-1), game.current.waypoints[1].cell);
  assert.strictEqual(game.hintCount, 3);
  // 用尽后拒绝。
  while (game.progress.hintsRemaining() > 0) game.progress.consumeHint();
  assert.strictEqual(game.useHint(), false);
  assert.strictEqual(game.view().feedback?.kind, "notice");
  // 走完剩余路径：结算含分数拆解、星级与标签；本局用过 3 次提示 → 一星。
  for (const cell of game.current.solution.slice(game.engine.getSnapshot().path.length)) game.moveTo(cell);
  assert.strictEqual(game.engine.getSnapshot().status, "completed");
  const summary = game.completionSummary;
  assert.strictEqual(summary.stars, 1);
  assert.ok(summary.breakdown.total >= MIN_SCORE);
  assert.strictEqual(summary.breakdown.hintPenalty, HINT_PENALTY * 3);
  assert.ok(Array.isArray(summary.labels) && summary.labels.length);
  assert.strictEqual(game.view().points, summary.breakdown.total);
  assert.strictEqual(game.progress.starsFor(game.current.id), 1);
  assert.strictEqual(summary.hintReward, undefined, "非三星不奖励提示");
  game.destroy();
}
{
  // 三星通关：奖励 1 次提示，连击提示出现，状态条连击计数。
  const game = createGame();
  game.startedAt = Date.now() - 5000;
  const solution = game.current.solution;
  for (const cell of solution.slice(0, 6)) game.moveTo(cell);
  assert.strictEqual(game.view().status.combo, 5);
  assert.ok(["combo", "waypoint"].includes(game.view().feedback?.kind));
  const before = game.progress.hintsRemaining();
  for (const cell of solution.slice(6)) game.moveTo(cell);
  assert.strictEqual(game.completionSummary.stars, 3);
  assert.ok(game.completionSummary.labels.includes("Perfect"));
  assert.strictEqual(game.completionSummary.hintReward, PERFECT_CLEAR_REWARD);
  assert.strictEqual(game.progress.hintsRemaining(), before + PERFECT_CLEAR_REWARD);
  assert.strictEqual(game.completionSummary.breakdown.noMistakeBonus, NO_MISTAKE_BONUS);
  // 连续通关第二局：连胜奖励 +50。
  game.renderer.controls.next = { x: 0, y: 0, width: 10, height: 10 };
  game.handleStart({ touches: [{ clientX: 5, clientY: 5 }] });
  game.startedAt = Date.now() - 5000;
  for (const cell of game.current.solution) game.moveTo(cell);
  assert.strictEqual(game.completionSummary.breakdown.streakBonus, WIN_STREAK_BONUSES[0]);
  assert.strictEqual(game.completionSummary.winStreak, 2);
  // 中途放弃换题：连胜中断。
  game.renderer.controls.next = { x: 0, y: 0, width: 10, height: 10 };
  game.handleStart({ touches: [{ clientX: 5, clientY: 5 }] });
  game.moveTo(game.current.solution[0]);
  game.selectStandard("6x6", "medium");
  assert.strictEqual(game.progress.winStreak(), 0);
  // 提示逻辑在限时模式下不可用（提示按钮已从控制区移除，逻辑保留）。
  game.startClock("easy");
  assert.strictEqual(game.useHint(), false);
  game.destroy();
}

// 7. 渲染器：控制按钮、状态条、星级与分数拆解文案、提示高亮与错误框。
{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const text = [], arcs = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc(x, y, r) { arcs.push([x, y, r]); }, quadraticCurveTo() {}, rect() {}, strokeText() {}, fillText(value) { text.push(String(value)); }, measureText(value) { return { width: String(value).length * 7 }; }, createLinearGradient() { return { addColorStop() {} }; } };
  const context = new Proxy(target, { get: (object, property) => (property in object ? object[property] : () => {}), set: (object, property, value) => { object[property] = value; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => context });
  renderer.setLevel(level);
  const snapshot = { status: "active", path: level.solution.slice(0, 3), moves: 2, nextWaypoint: 2, message: "", errors: 1, combo: 2, maxCombo: 2, hintCells: [], totalWaypoints: level.waypoints.length };
  const view = { mode: "standard", progressiveLevel: 1, difficulty: "easy", difficultyLabel: "简单", gridSize: "6x6", sound: true, points: 120, time: "0:12", clockActive: false, clockSetupVisible: false, clockEnded: false, clockTiers: Object.values(CLOCK_TIERS), rankings: { friend: { text: "" }, global: { text: "总榜" } }, completion: { best: { elapsedMs: 0 }, streak: 0 }, weatherEnabled: false,
    status: { currentWaypoint: 1, totalWaypoints: level.waypoints.length, errors: 1, combo: 2, hintsRemaining: 2, bestMs: 18420 }, hintCells: [level.solution[3]], feedback: { kind: "error", cell: level.solution[5], at: Date.now() } };
  renderer.render(snapshot, view);
  assert.ok(!renderer.controls.hint, "提示按钮热区应已移除");
  assert.ok(!text.some((value) => value.includes("提示")), "控制区不应出现提示按钮文案");
  assert.ok(text.some((value) => value.includes(`数字 1/${level.waypoints.length}`) && value.includes("错误 1") && value.includes("连击 ×2") && value.includes("最佳 0:19")), `状态条缺失：${text.join(" | ")}`);
  assert.ok(!text.some((value) => value.includes("提示 2")), "状态条不应再显示剩余提示");
  assert.ok(renderer.controls.undo.x < renderer.controls.reset.x, "撤回位于清空左侧");
  const hintArc = arcs.find(([x, y, r]) => Math.abs(r - renderer.board.cell * .36) < .01);
  assert.ok(hintArc, "提示格应绘制高亮圆斑");
  text.length = 0;
  renderer.render({ ...snapshot, status: "completed", path: level.solution, nextWaypoint: level.waypoints.length + 1 }, { ...view, completionVisible: true, completion: { best: { elapsedMs: 16800 }, streak: 3, winStreak: 3, stars: 2, labels: ["Great", "Fast"], stats: { errors: 1, hints: 0 }, breakdown: { base: 360, speedBonus: 40, noMistakeBonus: 0, comboBonus: 50, streakBonus: 100, hintPenalty: 0, undoPenalty: 0, errorPenalty: 5, total: 545 } } });
  assert.strictEqual(text.filter((value) => value === "★").length, 3);
  assert.ok(text.includes("Great  ·  Fast"));
  assert.ok(text.includes("+545 分"));
  assert.ok(text.some((value) => value.includes("基础 360") && value.includes("速度 +40") && value.includes("连胜 +100") && value.includes("扣 −5")));
  assert.ok(text.some((value) => value.includes("最佳 0:17") && value.includes("连续通关 3 局")));
  assert.ok(text.includes("未使用"));
  delete global.wx;
}

console.log("PASS scoring-hints");
