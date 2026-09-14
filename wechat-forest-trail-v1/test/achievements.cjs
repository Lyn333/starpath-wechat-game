const assert = require("assert");
const { BADGES, CATEGORIES, LAUNCH_MAX_TIER, MEMORY_BASE_BADGES, TIERS, TITLES, badgeById, evaluateBadge, tiersAvailable } = require("../core/achievements/BadgeCatalog");
const { CHAIN_COMBO_TARGET, FAST_6X6_LIGHTNING_MS, FAST_6X6_QUICK_MS, applyCompletion, breakRuns, diffUnlocks, emptyStats, evaluateAll, isConsecutiveDay, nearestGoals, normalizeStats, unlockedTitles } = require("../core/achievements/AchievementTracker");
const { ForestTrailMiniGame } = require("../core/GameFlow");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ProgressStore, migrateState } = require("../core/ProgressStore");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { CLOCK_TIERS } = require("../core/modes/ModeCatalog");

// 1. 图鉴结构：首发 24 枚、7 个类别都有徽章、只开放铜/银、ID 唯一、每枚都有方向提示。
assert.strictEqual(BADGES.length, 24);
assert.strictEqual(new Set(BADGES.map((badge) => badge.id)).size, 24);
for (const badge of BADGES) {
  assert.ok(CATEGORIES[badge.category], `${badge.id} 类别未知`);
  assert.ok(badge.hint && badge.name && badge.icon, `${badge.id} 缺少展示字段`);
  assert.ok(badge.tiers.length >= 1 && badge.tiers.every((step) => TIERS.includes(step.tier) && step.target >= 1 && step.describe));
  assert.ok(tiersAvailable(badge).every((step) => ["bronze", "silver"].includes(step.tier)), `${badge.id} 首发只应开放铜银`);
}
assert.strictEqual(LAUNCH_MAX_TIER, "silver");
assert.ok(Object.keys(CATEGORIES).every((category) => BADGES.some((badge) => badge.category === category)));
for (const name of ["初次连线", "数字启程", "第一颗星", "开始记忆", "一笔不错", "完美棋盘", "快手连线", "闪电数字", "无误连线", "撤回绝缘体", "冷静到底", "速度大师", "淡影行者", "过目不忘", "闪现捕手", "短忆高手", "盲连专家", "记忆耐力", "连续专注", "记忆连胜", "一周不忘", "今日签到", "每日三星", "终极记忆者"]) assert.ok(BADGES.some((badge) => badge.name === name), `缺少首发徽章：${name}`);
assert.ok(MEMORY_BASE_BADGES.every((id) => badgeById(id)?.category === "memory"));

// 2. 等级评估：累计值决定当前档与下一档剩余；一次性徽章只有铜牌。
{
  const stroke = badgeById("flawless-stroke");
  assert.deepStrictEqual(evaluateBadge(stroke, { ...emptyStats(), zeroErrorClears: 0 }).tier, null);
  const bronze = evaluateBadge(stroke, { ...emptyStats(), zeroErrorClears: 2 });
  assert.strictEqual(bronze.tier, "bronze"); assert.deepStrictEqual([bronze.next.tier, bronze.next.remaining], ["silver", 3]);
  const silver = evaluateBadge(stroke, { ...emptyStats(), zeroErrorClears: 7 });
  assert.strictEqual(silver.tier, "silver"); assert.strictEqual(silver.next, null, "首发银牌为满级");
  const first = evaluateBadge(badgeById("first-link"), { ...emptyStats(), completed: 3 });
  assert.strictEqual(first.tier, "bronze"); assert.strictEqual(first.next, null);
}

// 3. 追踪器：一局上下文如何折算进累计统计，以及防刷规则。
{
  const base = { gridSize: "6x6", difficulty: "easy", mode: "standard", elapsedMs: 12000, parTimeMs: 90000, errors: 0, undos: 0, hints: 0, hintTiers: [], maxCombo: 35, stars: 3, lastWaypointsClean: true, winStreak: 1, dateKey: "2026-09-10" };
  const one = applyCompletion(emptyStats(), base);
  assert.strictEqual(one.completed, 1); assert.strictEqual(one.completedBySize["6x6"], 1);
  assert.strictEqual(one.threeStarClears, 1); assert.strictEqual(one.zeroErrorClears, 1); assert.strictEqual(one.perfectClears, 1);
  assert.strictEqual(one.fast6x6Under30, 1); assert.strictEqual(one.fast6x6Under15, 1, `${FAST_6X6_LIGHTNING_MS}ms 内应计闪电`);
  assert.strictEqual(one.combo20Clears, 1, `连击 ≥${CHAIN_COMBO_TARGET} 应计无误连线`);
  assert.strictEqual(one.calmFinishClears, 1); assert.strictEqual(one.underParBySize["6x6"], 1);
  assert.strictEqual(one.noUndoRun, 1); assert.strictEqual(one.dayStreak, 1); assert.strictEqual(one.lastPlayDate, "2026-09-10");
  assert.strictEqual(one.dailyClears, 0, "普通模式不计每日");
  assert.strictEqual(one.memoryClears, 0);
  // 强提示（自动连接）后：零错误、速度、无误路线全部不计；撤回中断无撤回连续。
  const cheated = applyCompletion(one, { ...base, hints: 1, hintTiers: ["auto"], undos: 1 });
  assert.strictEqual(cheated.zeroErrorClears, 1); assert.strictEqual(cheated.fast6x6Under30, 1); assert.strictEqual(cheated.underParBySize["6x6"], 1);
  assert.strictEqual(cheated.calmFinishClears, 1, "用过提示不计冷静到底");
  assert.strictEqual(cheated.noUndoRun, 0); assert.strictEqual(cheated.bestNoUndoRun, 1, "历史最高保留");
  assert.strictEqual(cheated.completed, 2, "累计完成仍然计数");
  // 轻提示不算强提示，但 hints>0 仍然不计“零提示”类。
  const light = applyCompletion(emptyStats(), { ...base, hints: 1, hintTiers: ["light"] });
  assert.strictEqual(light.zeroErrorClears, 1); assert.strictEqual(light.fast6x6Under30, 1); assert.strictEqual(light.calmFinishClears, 0);
  // 6×6 成绩不计入 8×8 速度徽章；30 秒边界。
  const big = applyCompletion(emptyStats(), { ...base, gridSize: "8x8", elapsedMs: 10000 });
  assert.strictEqual(big.fast6x6Under30, 0); assert.strictEqual(big.underParBySize["8x8"], 1);
  assert.strictEqual(applyCompletion(emptyStats(), { ...base, elapsedMs: FAST_6X6_QUICK_MS }).fast6x6Under30, 1);
  assert.strictEqual(applyCompletion(emptyStats(), { ...base, elapsedMs: FAST_6X6_QUICK_MS + 1 }).fast6x6Under30, 0);
  // 每日挑战：同一天只计一次；三星同理。
  const dailyA = applyCompletion(emptyStats(), { ...base, mode: "daily", dateKey: "2026-09-10" });
  const dailyRepeat = applyCompletion(dailyA, { ...base, mode: "daily", dateKey: "2026-09-10" });
  const dailyB = applyCompletion(dailyRepeat, { ...base, mode: "daily", dateKey: "2026-09-11", stars: 2 });
  assert.strictEqual(dailyA.dailyClears, 1); assert.strictEqual(dailyRepeat.dailyClears, 1); assert.strictEqual(dailyB.dailyClears, 2);
  assert.strictEqual(dailyB.dailyThreeStars, 1);
  // 连续天数：隔天 +1，跨天中断归 1，同一天不重复；历史最长保留。
  assert.strictEqual(isConsecutiveDay("2026-09-30", "2026-10-01"), true); assert.strictEqual(isConsecutiveDay("2026-09-10", "2026-09-12"), false);
  let days = emptyStats();
  for (const dateKey of ["2026-09-01", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05"]) days = applyCompletion(days, { ...base, dateKey });
  assert.strictEqual(days.dayStreak, 1); assert.strictEqual(days.longestDayStreak, 3);
  // 记忆模式：记录模式、隐藏零错误、8×8 零提示盲连、连续记忆局；普通局中断记忆连续。
  let memory = emptyStats();
  memory = applyCompletion(memory, { ...base, memoryMode: "faded" });
  memory = applyCompletion(memory, { ...base, gridSize: "8x8", memoryMode: "hidden" });
  memory = applyCompletion(memory, { ...base, memoryMode: "flash", flashCombo: 12 });
  memory = applyCompletion(memory, { ...base, memoryMode: "hidden", previewSeconds: 3 });
  assert.strictEqual(memory.memoryClears, 4); assert.strictEqual(memory.memoryClearsByMode.faded, 1);
  assert.strictEqual(memory.hiddenZeroErrorClears, 2); assert.strictEqual(memory.blind8x8Clears, 1); assert.strictEqual(memory.flashCombo10Clears, 1); assert.strictEqual(memory.shortPreview6x6Clears, 1);
  assert.strictEqual(memory.memoryRun, 4);
  memory = applyCompletion(memory, base);
  assert.strictEqual(memory.memoryRun, 0); assert.strictEqual(memory.bestMemoryRun, 4);
  // breakRuns 只清连续计数，不动累计。
  const broken = breakRuns({ ...one, noUndoRun: 5, memoryRun: 3 });
  assert.strictEqual(broken.noUndoRun, 0); assert.strictEqual(broken.memoryRun, 0); assert.strictEqual(broken.completed, one.completed);
  // normalizeStats 对脏数据健壮。
  const dirty = normalizeStats({ completed: "7", completedBySize: { "6x6": "x" }, dailyDates: ["a", 3], lastPlayDate: 5 });
  assert.strictEqual(dirty.completed, 7); assert.strictEqual(dirty.completedBySize["6x6"], 0); assert.deepStrictEqual(dirty.dailyDates, ["a"]); assert.strictEqual(dirty.lastPlayDate, null);
}

// 4. 解锁 diff：首次解锁 / 升级 / 不变；终极徽章依赖其他徽章；称号；下一目标排序。
{
  const ctx = {};
  const stats = { ...emptyStats(), completed: 1, completedBySize: { "6x6": 1 }, zeroErrorClears: 1 };
  const evaluations = evaluateAll(stats, ctx, {});
  const { unlocked, events } = diffUnlocks({}, evaluations, 1000);
  assert.deepStrictEqual(events.filter((event) => event.type === "unlock").map((event) => event.id).sort(), ["digit-departure", "first-link", "flawless-stroke"]);
  assert.strictEqual(unlocked["flawless-stroke"].tier, "bronze"); assert.strictEqual(unlocked["flawless-stroke"].unlockedAt, 1000);
  const upgradedStats = { ...stats, zeroErrorClears: 5 };
  const second = diffUnlocks(unlocked, evaluateAll(upgradedStats, ctx, unlocked), 2000);
  assert.deepStrictEqual(second.events, [{ type: "upgrade", id: "flawless-stroke", from: "bronze", tier: "silver", next: null }]);
  assert.strictEqual(second.unlocked["flawless-stroke"].upgradedAt, 2000); assert.strictEqual(second.unlocked["flawless-stroke"].unlockedAt, 1000, "首次解锁时间不变");
  assert.strictEqual(second.unlocked["first-link"].count, 1);
  assert.deepStrictEqual(diffUnlocks(second.unlocked, evaluateAll(upgradedStats, ctx, second.unlocked), 3000).events, [], "重复评估不重复触发");
  // 终极记忆者：只有全部基础记忆徽章解锁后才亮。
  const memoryStats = { ...emptyStats(), memoryClears: 30, memoryClearsByMode: { faded: 5 }, hiddenZeroErrorClears: 1, flashCombo10Clears: 1, shortPreview6x6Clears: 1, blind8x8Clears: 1, bestMemoryRun: 5 };
  const memoryEval = evaluateAll(memoryStats, ctx, {});
  assert.strictEqual(memoryEval["ultimate-memory"].tier, "bronze");
  assert.strictEqual(evaluateAll({ ...memoryStats, blind8x8Clears: 0 }, ctx, {})["ultimate-memory"].tier, null);
  // 称号。
  assert.deepStrictEqual(unlockedTitles({}), []);
  assert.ok(unlockedTitles({ "first-link": { tier: "bronze" }, "digit-departure": { tier: "bronze" }, "first-star": { tier: "bronze" } }).includes("digit-novice"));
  assert.ok(unlockedTitles({ "quick-hands": { tier: "silver" } }).includes("lightning-memory"));
  assert.ok(!unlockedTitles({ "quick-hands": { tier: "bronze" } }).includes("lightning-memory"));
  assert.ok(unlockedTitles(Object.fromEntries(BADGES.map((badge) => [badge.id, { tier: "silver" }]))).includes("ultimate-linker"));
  assert.ok(TITLES.every((title) => title.id && title.name && title.condition));
  // 下一目标：剩余最少优先，忽略没有任何进度的路线。
  const goals = nearestGoals(evaluateAll({ ...emptyStats(), completed: 1, zeroErrorClears: 4, perfectClears: 1, fast6x6Under30: 2 }, ctx, {}));
  assert.deepStrictEqual(goals.map((goal) => goal.id), ["flawless-stroke", "quick-hands"]);
  assert.strictEqual(goals[0].remaining, 1);
}

// 5. ProgressStore：markComplete 产出成就事件并落盘；迁移；称号装备；连胜中断清连续计数。
{
  const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
  const level = pipeline.build({ gridSize: "6x6", difficulty: "easy", seed: "achievement-fixture" });
  const storage = new MemoryStorageAdapter();
  let clock = new Date("2026-09-10T02:00:00Z").getTime();
  const progress = new ProgressStore({ storage, now: () => clock });
  const summary = progress.markComplete(level, { moves: 35, elapsedMs: 12000, errors: 0, undos: 0, hints: 0, maxCombo: 35, points: 900, stars: 3, mode: "standard", parTimeMs: 90000, hintTiers: [], lastWaypointsClean: true });
  const ids = summary.achievementEvents.badges.map((event) => event.id).sort();
  for (const id of ["first-link", "digit-departure", "first-star", "flawless-stroke", "perfect-board", "quick-hands", "lightning-digit", "unbroken-chain", "calm-finish"]) assert.ok(ids.includes(id), `首局完美通关应解锁 ${id}，实际 ${ids.join(",")}`);
  assert.ok(summary.achievementEvents.titles.includes("digit-novice"));
  const reloaded = new ProgressStore({ storage, now: () => clock });
  assert.strictEqual(reloaded.achievementState().unlocked["first-link"].tier, "bronze");
  assert.deepStrictEqual(reloaded.achievementState().titles, progress.achievementState().titles);
  assert.strictEqual(reloaded.equipTitle("digit-novice"), true); assert.strictEqual(reloaded.equippedTitle(), "digit-novice");
  assert.strictEqual(reloaded.equipTitle("ultimate-linker"), false, "未解锁称号不可装备");
  assert.strictEqual(reloaded.equipTitle(null), true); assert.strictEqual(reloaded.equippedTitle(), null);
  // 同一题目重复通关：累计类继续计数，“初次”类不重复触发。
  const again = progress.markComplete(level, { moves: 35, elapsedMs: 12000, errors: 0, undos: 0, hints: 0, maxCombo: 35, points: 900, stars: 3, mode: "standard", parTimeMs: 90000 });
  assert.ok(!again.achievementEvents.badges.some((event) => event.type === "unlock" && event.id === "first-link"));
  assert.strictEqual(progress.achievementState().stats.completed, 2);
  // 每日挑战：三次不同日期 → 今日签到铜牌；同一天重复不计。
  const daily = { ...level, id: "daily-1", sourceKind: "daily", challengeDate: "2026-09-10" };
  progress.markComplete(daily, { moves: 35, elapsedMs: 20000, errors: 1, stars: 2, mode: "daily" });
  progress.markComplete(daily, { moves: 35, elapsedMs: 20000, errors: 1, stars: 2, mode: "daily" });
  assert.strictEqual(progress.achievementState().stats.dailyClears, 1);
  assert.strictEqual(progress.achievementState().unlocked["daily-checkin"].tier, "bronze");
  // breakWinStreak 清掉“无撤回连续”。
  assert.ok(progress.achievementState().stats.noUndoRun >= 1);
  progress.breakWinStreak();
  assert.strictEqual(progress.achievementState().stats.noUndoRun, 0);
  assert.ok(progress.achievementState().stats.bestNoUndoRun >= 1);
  // 迁移：v7 存档没有 achievements 字段；脏数据被清理。
  const legacy = migrateState({ version: 7, completed: {}, achievements: { unlocked: { "first-link": { tier: "bronze", unlockedAt: 5 }, bogus: { tier: null }, "nope": "x" }, titles: ["digit-novice", "fake"], equippedTitle: "fake", stats: { completed: "3" } } });
  assert.deepStrictEqual(Object.keys(legacy.achievements.unlocked), ["first-link"]);
  assert.deepStrictEqual(legacy.achievements.titles, ["digit-novice"]); assert.strictEqual(legacy.achievements.equippedTitle, null);
  assert.strictEqual(legacy.achievements.stats.completed, 3);
  assert.deepStrictEqual(migrateState({ version: 7 }).achievements.unlocked, {});
}

// 6. GameFlow：结算带成就事件与下一目标；成就入口与图鉴交互；冷静到底依赖“最后 5 个数字零错误”。
class RendererMock { constructor() { this.controls = {}; } setLevel() {} render(snapshot, view) { this.lastView = view; } hit(box, point) { return Boolean(box && point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height); } resize() {} toCell() { return null; } startCompletionFireworks() {} clearCompletionFireworks() {} }
class SoundMock { startBackgroundMusic() {} setEnabled() {} tap() {} coin() {} undo() {} reset() {} complete() {} playCompletionCelebration() {} destroy() {} }
class LeaderboardMock { initialize() { return Promise.resolve(true); } status() { return { friend: { text: "" }, global: { text: "" } }; } submitCompletion() { return Promise.resolve(true); } submitClockResult() { return Promise.resolve(true); } openFriendBoard() { return true; } }
const createGame = () => new ForestTrailMiniGame({}, [], { progress: new ProgressStore({ storage: new MemoryStorageAdapter() }), renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock(), weatherEnabled: false });
const tap = (game, x, y) => game.handleStart({ touches: [{ clientX: x, clientY: y }] });
{
  const game = createGame();
  assert.deepStrictEqual(game.view().badgeSummary, { unlocked: 0, total: 24, title: null });
  game.startedAt = Date.now() - 5000;
  for (const cell of game.current.solution) game.moveTo(cell);
  const summary = game.completionSummary;
  assert.ok(summary.achievementEvents.badges.length >= 4);
  assert.ok(summary.achievementEvents.badges.some((event) => event.id === "calm-finish"), "无错误通关应触发冷静到底");
  assert.ok(Array.isArray(summary.nextGoals) && summary.nextGoals.length > 0 && summary.nextGoals[0].name);
  assert.ok(game.view().badgeSummary.unlocked >= 4);
  assert.strictEqual(game.view().badgeSummary.title, null, "解锁称号不自动装备");
  // 通关弹窗里的“查看徽章”打开图鉴，页签切换与称号装备。
  game.renderer.controls.viewBadges = { x: 0, y: 0, width: 10, height: 10 };
  tap(game, 5, 5);
  assert.strictEqual(game.view().badgesVisible, true);
  assert.strictEqual(game.view().badgeCollection.badges.length, 24);
  assert.ok(game.view().badgeCollection.badges.find((badge) => badge.id === "first-link").tier === "bronze");
  assert.ok(game.view().badgeCollection.badges.find((badge) => badge.id === "blind-expert").tier === null);
  game.renderer.controls.badgeTabs = [{ id: "titles", x: 0, y: 0, width: 10, height: 10 }];
  tap(game, 5, 5);
  assert.strictEqual(game.view().badgePage, "titles");
  // 这一局是三星，入门三枚齐全 → “数字新手”解锁但未装备；点击即装备，再点取消。
  const novice = game.view().badgeCollection.titles.find((title) => title.id === "digit-novice");
  assert.ok(novice.unlocked && !novice.equipped);
  const ultimate = game.view().badgeCollection.titles.find((title) => title.id === "ultimate-linker");
  assert.ok(!ultimate.unlocked);
  game.renderer.controls.badgeTitles = [{ id: "digit-novice", unlocked: true, equipped: false, x: 20, y: 20, width: 10, height: 10 }, { id: "ultimate-linker", unlocked: false, equipped: false, x: 40, y: 40, width: 10, height: 10 }];
  tap(game, 45, 45);
  assert.strictEqual(game.progress.equippedTitle(), null, "未解锁称号点击无效");
  tap(game, 25, 25);
  assert.strictEqual(game.progress.equippedTitle(), "digit-novice");
  assert.strictEqual(game.view().badgeSummary.title, "数字新手");
  game.renderer.controls.badgeTitles[0].equipped = true;
  tap(game, 25, 25);
  assert.strictEqual(game.progress.equippedTitle(), null, "再次点击取消装备");
  game.renderer.controls.badgesClose = { x: 50, y: 50, width: 10, height: 10 };
  tap(game, 55, 55);
  assert.strictEqual(game.view().badgesVisible, false);
  // 头部“成就”按钮同样能打开。
  game.renderer.controls.badges = { x: 100, y: 100, width: 10, height: 10 };
  game.completionDismissed = true;
  tap(game, 105, 105);
  assert.strictEqual(game.view().badgesVisible, true);
  game.destroy();
}
{
  // 最后 5 个数字中出现错误 → 不计冷静到底；使用自动连接 → 不计一笔不错。
  const game = createGame();
  const total = game.current.waypoints.length, solution = game.current.solution;
  const lastTarget = game.current.waypoints[total - 3].cell, lastIndex = solution.findIndex((cell) => cell.row === lastTarget.row && cell.col === lastTarget.col);
  for (const cell of solution.slice(0, lastIndex)) game.moveTo(cell);
  // 在“最后 5 个数字”窗口内制造一次真实错误：走到一个与当前末端相邻的已走格（非上一步）。
  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  let injected = false;
  for (let index = lastIndex; index < solution.length; index += 1) {
    if (!injected) {
      const tail = game.engine.getSnapshot().path.at(-1);
      // 排除上一步（踩回上一步是合法回退，不算错误）。
      const revisit = game.engine.getSnapshot().path.slice(0, -2).find((cell) => adjacent(cell, tail));
      if (revisit) { assert.strictEqual(game.moveTo(revisit), false, "重踏应被拒绝"); injected = true; }
    }
    game.moveTo(solution[index]);
  }
  assert.ok(injected, "应在收尾阶段成功制造一次错误");
  assert.ok(game.engine.getSnapshot().errors >= 1);
  assert.strictEqual(game.engine.getSnapshot().status, "completed");
  assert.ok(!game.completionSummary.achievementEvents.badges.some((event) => event.id === "calm-finish"));
  assert.ok(!game.completionSummary.achievementEvents.badges.some((event) => event.id === "flawless-stroke"));
  game.destroy();
  const cheat = createGame();
  cheat.moveTo(cheat.current.solution[0]);
  cheat.hintCount = 2; cheat.useHint();
  assert.deepStrictEqual(cheat.hintTiers, ["auto"]);
  for (const cell of cheat.current.solution.slice(cheat.engine.getSnapshot().path.length)) cheat.moveTo(cell);
  assert.ok(!cheat.completionSummary.achievementEvents.badges.some((event) => ["flawless-stroke", "quick-hands", "calm-finish"].includes(event.id)), "自动连接后不应获得零错误/速度/冷静徽章");
  assert.ok(cheat.completionSummary.achievementEvents.badges.some((event) => event.id === "first-link"), "累计/首次完成仍然计数");
  cheat.destroy();
}

// 7. 渲染器：成就按钮、图鉴弹窗三个页签、锁定/解锁图标、结算页成就行与“查看徽章”按钮。
{
  global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
  const text = [];
  const target = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {}, save() {}, restore() {}, strokeText() {}, fillText(value) { text.push(String(value)); }, measureText(value) { return { width: String(value).length * 7 }; }, createLinearGradient() { return { addColorStop() {} }; } };
  const context = new Proxy(target, { get: (object, property) => (property in object ? object[property] : () => {}), set: (object, property, value) => { object[property] = value; return true; } });
  const renderer = new SingleBoardRenderer({ getContext: () => context });
  const solution = []; for (let row = 0; row < 6; row += 1) for (let index = 0; index < 6; index += 1) solution.push({ row, col: row % 2 ? 5 - index : index });
  renderer.setLevel({ id: "r", gridSize: "6x6", difficulty: "easy", rows: 6, cols: 6, walls: [], solution, waypoints: [{ number: 1, cell: solution[0] }, { number: 2, cell: solution.at(-1) }] });
  const game = createGame();
  const snapshot = { status: "idle", path: [], moves: 0, nextWaypoint: 1, message: "", errors: 0, combo: 0, maxCombo: 0, hintCells: [], totalWaypoints: 2 };
  const view = { ...game.view(snapshot), mode: "standard", clockTiers: Object.values(CLOCK_TIERS), weatherEnabled: false, badgesVisible: true, badgePage: "badges", badgeCollection: game.badgeCollection() };
  renderer.render(snapshot, view);
  assert.ok(renderer.controls.badges, "头部应有成就入口");
  assert.ok(text.includes("🏅 成就 0/24"));
  assert.ok(renderer.controls.badgesClose && renderer.controls.badgeTabs?.length === 3);
  assert.ok(text.includes("成就") && text.includes("徽章图鉴") && text.includes("我的称号") && text.includes("统计数据"));
  assert.ok(text.includes("初次连线") && text.includes("🔒"), "锁定徽章显示锁图标");
  assert.ok(renderer.controls.badgePageNext, "24 枚需要翻页");
  text.length = 0;
  renderer.render(snapshot, { ...view, badgePage: "titles" });
  assert.ok(renderer.controls.badgeTitles?.length === TITLES.length);
  assert.ok(text.includes("数字新手") && text.includes("未解锁"));
  text.length = 0;
  renderer.render(snapshot, { ...view, badgePage: "stats", achievementStats: { completed: 12, threeStarClears: 4, longestWinStreak: 6 }, records: { fastestMs: 18420, fewestErrors: 0 }, totalStars: 21 });
  assert.ok(text.includes("12 局") && text.includes("0:19") && text.includes("21 ★"));
  // 结算页：新徽章行与两个并排按钮。
  text.length = 0;
  game.startedAt = Date.now() - 5000;
  for (const cell of game.current.solution) game.moveTo(cell);
  renderer.setLevel(game.current);
  renderer.render(game.engine.getSnapshot(), { ...game.view(), clockTiers: Object.values(CLOCK_TIERS), weatherEnabled: false, badgesVisible: false });
  assert.ok(text.some((value) => value.startsWith("新徽章 · ")), `结算页应显示新徽章，实际：${text.join(" | ")}`);
  assert.ok(text.some((value) => value.startsWith("距离下一徽章：")));
  assert.ok(renderer.controls.viewBadges && renderer.controls.leaderboard && renderer.controls.viewBadges.x > renderer.controls.leaderboard.x);
  assert.ok(text.includes("查看徽章"));
  renderer.render(game.engine.getSnapshot(), { ...game.view(), clockTiers: Object.values(CLOCK_TIERS), weatherEnabled: false, completionVisible: false });
  assert.strictEqual(renderer.controls.viewBadges, undefined, "弹窗隐藏后热区清空");
  game.destroy();
  delete global.wx;
}

console.log("PASS achievements");
