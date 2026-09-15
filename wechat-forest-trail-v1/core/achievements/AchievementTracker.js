/**
 * 成就追踪：纯函数。输入“旧累计统计 + 本局上下文”，输出“新统计 + 本局新解锁/升级列表”。
 * 持久化交给 ProgressStore；这里不碰 wx。
 *
 * 防刷规则（文档第十节）：
 *   - 自动连接 / 路径提示（强提示）后，本局不计零提示、零错误与速度类
 *   - 同一题目重复完成只计累计类，不重复计“首次完成”类（由 firstClear 标志控制）
 *   - 每日挑战每个日期只计 1 次
 *   - 连胜中断保留历史最高
 */

const { BADGES, TITLES, evaluateBadge, tierIndex } = require("./BadgeCatalog");

const FAST_6X6_QUICK_MS = 30000;
const FAST_6X6_LIGHTNING_MS = 15000;
const CHAIN_COMBO_TARGET = 20;
const CALM_FINISH_WAYPOINTS = 5;
const STRONG_HINT_TIERS = new Set(["path", "auto"]);

function emptyStats() {
  return {
    completed: 0,
    completedBySize: {},
    threeStarClears: 0,
    zeroErrorClears: 0,
    perfectClears: 0,
    fast6x6Under30: 0,
    fast6x6Under15: 0,
    combo20Clears: 0,
    calmFinishClears: 0,
    underParBySize: {},
    noUndoRun: 0,
    bestNoUndoRun: 0,
    longestWinStreak: 0,
    dayStreak: 0,
    longestDayStreak: 0,
    lastPlayDate: null,
    dailyClears: 0,
    dailyDates: [],
    dailyThreeStars: 0,
    memoryClears: 0,
    memoryClearsByMode: {},
    hiddenZeroErrorClears: 0,
    flashCombo10Clears: 0,
    shortPreview6x6Clears: 0,
    blind8x8Clears: 0,
    memoryRun: 0,
    bestMemoryRun: 0,
    fruitThemeClears: 0,
    spaceThemeClears: 0,
    fruitThemeStars: 0,
    spaceThemeStars: 0,
    challengeClears: 0,
    challengeStars: 0,
  };
}

function nonNegativeInt(value) { return Math.max(0, Math.floor(Number(value) || 0)); }

function normalizeStats(value) {
  const base = emptyStats();
  if (!value || typeof value !== "object") return base;
  const result = { ...base };
  for (const key of Object.keys(base)) {
    if (key === "completedBySize" || key === "underParBySize" || key === "memoryClearsByMode") result[key] = Object.fromEntries(Object.entries(value[key] || {}).map(([k, v]) => [k, nonNegativeInt(v)]));
    else if (key === "dailyDates") result[key] = Array.isArray(value[key]) ? value[key].filter((item) => typeof item === "string").slice(-400) : [];
    else if (key === "lastPlayDate") result[key] = typeof value[key] === "string" ? value[key] : null;
    else result[key] = nonNegativeInt(value[key]);
  }
  return result;
}

function isConsecutiveDay(previousKey, currentKey) {
  if (!previousKey || !currentKey) return false;
  const previous = Date.parse(`${previousKey}T00:00:00Z`), current = Date.parse(`${currentKey}T00:00:00Z`);
  return Number.isFinite(previous) && Number.isFinite(current) && Math.round((current - previous) / 86400000) === 1;
}

/**
 * ctx 字段：
 *   gridSize, difficulty, mode ("standard"|"daily"|"progressive"|"clock"), elapsedMs, parTimeMs,
 *   errors, undos, hints, hintTiers (本局用过的提示等级数组), maxCombo, stars,
 *   lastWaypointsClean (最后 N 个数字是否全部一次找到), firstClear (该题目首次完成), dateKey,
 *   memoryMode (null | "faded" | "hidden" | "flash" | "segmented"), previewSeconds, flashCombo,
 *   fruitThemeClears, spaceThemeClears, fruitThemeStars, spaceThemeStars, challengeClears, challengeStars
 */
function applyCompletion(previousStats, ctx) {
  const stats = normalizeStats(previousStats);
  const strongHint = (ctx.hintTiers || []).some((tier) => STRONG_HINT_TIERS.has(tier));
  const zeroHints = nonNegativeInt(ctx.hints) === 0;
  const zeroErrors = nonNegativeInt(ctx.errors) === 0 && !strongHint;
  const zeroUndos = nonNegativeInt(ctx.undos) === 0;
  const size = ctx.gridSize;
  const elapsed = nonNegativeInt(ctx.elapsedMs);
  const underPar = Number.isFinite(ctx.parTimeMs) && elapsed <= ctx.parTimeMs && !strongHint;

  stats.completed += 1;
  stats.completedBySize[size] = (stats.completedBySize[size] || 0) + 1;
  if (ctx.stars === 3) stats.threeStarClears += 1;
  if (zeroErrors) stats.zeroErrorClears += 1;
  if (ctx.stars === 3 && zeroErrors && zeroUndos) stats.perfectClears += 1;
  if (size === "6x6" && !strongHint && elapsed <= FAST_6X6_QUICK_MS) stats.fast6x6Under30 += 1;
  if (size === "6x6" && !strongHint && elapsed <= FAST_6X6_LIGHTNING_MS) stats.fast6x6Under15 += 1;
  if (nonNegativeInt(ctx.maxCombo) >= CHAIN_COMBO_TARGET) stats.combo20Clears += 1;
  if (ctx.lastWaypointsClean && zeroHints) stats.calmFinishClears += 1;
  if (underPar) stats.underParBySize[size] = (stats.underParBySize[size] || 0) + 1;

  stats.noUndoRun = zeroUndos ? stats.noUndoRun + 1 : 0;
  stats.bestNoUndoRun = Math.max(stats.bestNoUndoRun, stats.noUndoRun);
  stats.longestWinStreak = Math.max(stats.longestWinStreak, nonNegativeInt(ctx.winStreak));

  if (ctx.dateKey && ctx.dateKey !== stats.lastPlayDate) {
    stats.dayStreak = isConsecutiveDay(stats.lastPlayDate, ctx.dateKey) ? stats.dayStreak + 1 : 1;
    stats.longestDayStreak = Math.max(stats.longestDayStreak, stats.dayStreak);
    stats.lastPlayDate = ctx.dateKey;
  }

  if (ctx.mode === "daily" && ctx.dateKey && !stats.dailyDates.includes(ctx.dateKey)) {
    stats.dailyDates = [...stats.dailyDates, ctx.dateKey].slice(-400);
    stats.dailyClears += 1;
    if (ctx.stars === 3) stats.dailyThreeStars += 1;
  }

  if (ctx.memoryMode) {
    stats.memoryClears += 1;
    stats.memoryClearsByMode[ctx.memoryMode] = (stats.memoryClearsByMode[ctx.memoryMode] || 0) + 1;
    if (ctx.memoryMode === "hidden" && zeroErrors) stats.hiddenZeroErrorClears += 1;
    if (ctx.memoryMode === "flash" && nonNegativeInt(ctx.flashCombo) >= 10) stats.flashCombo10Clears += 1;
    if (size === "6x6" && Number(ctx.previewSeconds) <= 3) stats.shortPreview6x6Clears += 1;
    if (size === "8x8" && ctx.memoryMode === "hidden" && zeroHints) stats.blind8x8Clears += 1;
    stats.memoryRun += 1;
  } else {
    stats.memoryRun = 0;
  }
  stats.bestMemoryRun = Math.max(stats.bestMemoryRun, stats.memoryRun);
  if (ctx.mode === "challenge") {
    stats.fruitThemeClears = Math.max(stats.fruitThemeClears, nonNegativeInt(ctx.fruitThemeClears));
    stats.spaceThemeClears = Math.max(stats.spaceThemeClears, nonNegativeInt(ctx.spaceThemeClears));
    stats.fruitThemeStars = Math.max(stats.fruitThemeStars, nonNegativeInt(ctx.fruitThemeStars));
    stats.spaceThemeStars = Math.max(stats.spaceThemeStars, nonNegativeInt(ctx.spaceThemeStars));
    stats.challengeClears = Math.max(stats.challengeClears, nonNegativeInt(ctx.challengeClears));
    stats.challengeStars = Math.max(stats.challengeStars, nonNegativeInt(ctx.challengeStars));
  }
  return stats;
}

function breakRuns(previousStats) {
  const stats = normalizeStats(previousStats);
  return { ...stats, noUndoRun: 0, memoryRun: 0 };
}

// 对比新旧统计，得出本局新解锁 / 升级的徽章；unlocked 形如 { [badgeId]: { tier, unlockedAt, count } }。
function evaluateAll(stats, ctx, unlocked = {}) {
  const evaluations = {};
  for (const badge of BADGES) evaluations[badge.id] = evaluateBadge(badge, stats, ctx, unlocked);
  // 终极徽章依赖其他徽章的解锁状态，用第一轮结果再算一次。
  const provisional = { ...unlocked };
  for (const [id, evaluation] of Object.entries(evaluations)) if (evaluation.tier) provisional[id] = { ...(unlocked[id] || {}), tier: evaluation.tier };
  for (const badge of BADGES) evaluations[badge.id] = evaluateBadge(badge, stats, ctx, provisional);
  return evaluations;
}

function diffUnlocks(previousUnlocked, evaluations, now) {
  const unlocked = { ...previousUnlocked };
  const events = [];
  for (const [id, evaluation] of Object.entries(evaluations)) {
    if (!evaluation.tier) continue;
    const before = previousUnlocked[id];
    if (!before) { unlocked[id] = { tier: evaluation.tier, unlockedAt: now, upgradedAt: now, count: evaluation.value }; events.push({ type: "unlock", id, tier: evaluation.tier, next: evaluation.next }); continue; }
    unlocked[id] = { ...before, count: evaluation.value };
    if (tierIndex(evaluation.tier) > tierIndex(before.tier)) { unlocked[id] = { ...unlocked[id], tier: evaluation.tier, upgradedAt: now }; events.push({ type: "upgrade", id, from: before.tier, tier: evaluation.tier, next: evaluation.next }); }
  }
  return { unlocked, events };
}

function unlockedTitles(unlocked) { return TITLES.filter((title) => title.unlocked(unlocked)).map((title) => title.id); }

// 结果页“距离下一徽章”：取剩余最少的两枚（只看已有进度或已解锁的路线）。
function nearestGoals(evaluations, limit = 2) {
  return Object.values(evaluations)
    .filter((evaluation) => evaluation.next && (evaluation.value > 0 || evaluation.tier))
    .sort((a, b) => a.next.remaining - b.next.remaining || a.next.target - b.next.target)
    .slice(0, limit)
    .map((evaluation) => ({ id: evaluation.id, tier: evaluation.next.tier, remaining: evaluation.next.remaining, target: evaluation.next.target, value: evaluation.value }));
}

module.exports = {
  CALM_FINISH_WAYPOINTS, CHAIN_COMBO_TARGET, FAST_6X6_LIGHTNING_MS, FAST_6X6_QUICK_MS, STRONG_HINT_TIERS,
  applyCompletion, breakRuns, diffUnlocks, emptyStats, evaluateAll, isConsecutiveDay, nearestGoals, normalizeStats, unlockedTitles,
};
