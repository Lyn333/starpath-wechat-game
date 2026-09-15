const { WeChatStorageAdapter } = require("./platform/StorageAdapter");
const { normalizeSkill, updateSkill } = require("./player/SkillProfile");
const { chinaDateKey } = require("./modes/ModeCatalog");
const { DEFAULT_BOARD_THEME_ID, BOARD_THEMES, isBoardThemeId } = require("./themes/BoardThemes");
const { normalizeHintWallet, consumeHint, rewardHints, canUseHint } = require("./scoring/HintPolicy");
const { applyCompletion, breakRuns, diffUnlocks, evaluateAll, normalizeStats: normalizeAchievementStats, unlockedTitles } = require("./achievements/AchievementTracker");
const { TITLES } = require("./achievements/BadgeCatalog");
const { challengeRewardProgress } = require("./challenge/ChallengeLevels");

const STORAGE_KEY = "forest-trail-wechat-v1-progress-v1";
const STATE_VERSION = 8;
const RECENT_PUZZLE_LIMIT = 256;
// 每条未完成局都携带完整题目对象（含 solution），需要硬上限防止超过 wx 单 key 1MB 存储限制。
const ACTIVE_SESSION_LIMIT = 8;

function trimActiveSessions(sessions, limit = ACTIVE_SESSION_LIMIT) {
  const entries = Object.entries(sessions || {}).filter(([, session]) => session && typeof session === "object");
  if (entries.length <= limit) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).slice(0, limit));
}

function emptyState() {
  return {
    version: STATE_VERSION,
    completed: {},
    best: {},
    daily: {},
    continuations: {},
    sequences: {},
    recentPuzzleIds: [],
    activeSessions: {},
    clock: { best: {}, ordinals: {} },
    soundEnabled: true,
    boardTheme: DEFAULT_BOARD_THEME_ID,
    streak: { count: 0, lastDate: null },
    skill: normalizeSkill(),
    hints: { remaining: 0, lastRefillDate: null },
    stars: {},
    records: { fastestMs: null, fewestErrors: null, longestWinStreak: 0, bySize: {} },
    winStreak: 0,
    achievements: { stats: normalizeAchievementStats(), unlocked: {}, titles: [], equippedTitle: null, seenEvents: 0 },
  };
}

function normalizeAchievements(value) {
  const input = value && typeof value === "object" ? value : {};
  const unlocked = {};
  for (const [id, entry] of Object.entries(input.unlocked || {})) {
    if (!entry || typeof entry !== "object" || !entry.tier) continue;
    unlocked[id] = { tier: entry.tier, unlockedAt: Number(entry.unlockedAt) || 0, upgradedAt: Number(entry.upgradedAt) || Number(entry.unlockedAt) || 0, count: Math.max(0, Math.floor(Number(entry.count) || 0)) };
  }
  const titles = Array.isArray(input.titles) ? input.titles.filter((id) => TITLES.some((title) => title.id === id)) : [];
  return {
    stats: normalizeAchievementStats(input.stats),
    unlocked,
    titles,
    equippedTitle: titles.includes(input.equippedTitle) ? input.equippedTitle : null,
    seenEvents: Math.max(0, Math.floor(Number(input.seenEvents) || 0)),
  };
}

function normalizeStars(value) {
  const result = {};
  for (const [id, stars] of Object.entries(value || {})) { const count = Math.floor(Number(stars)); if (count >= 1 && count <= 3) result[id] = count; }
  return result;
}

function normalizeRecords(value) {
  const records = value && typeof value === "object" ? value : {};
  const optionalInt = (input) => (Number.isFinite(Number(input)) && input !== null ? Math.max(0, Math.floor(Number(input))) : null);
  return {
    fastestMs: optionalInt(records.fastestMs),
    fewestErrors: optionalInt(records.fewestErrors),
    longestWinStreak: Math.max(0, Math.floor(Number(records.longestWinStreak) || 0)),
    bySize: Object.fromEntries(Object.entries(records.bySize || {}).map(([size, entry]) => [size, { fastestMs: optionalInt(entry?.fastestMs), bestScore: Math.max(0, Math.floor(Number(entry?.bestScore) || 0)), bestStars: Math.min(3, Math.max(0, Math.floor(Number(entry?.bestStars) || 0))) }])),
  };
}

function migrateState(value) {
  const base = emptyState();
  if (!value || typeof value !== "object") return base;
  const migrated = {
    ...base,
    ...value,
    version: STATE_VERSION,
    completed: { ...base.completed, ...(value.completed || {}) },
    best: { ...base.best, ...(value.best || {}) },
    daily: { ...base.daily, ...(value.daily || {}) },
    continuations: { ...base.continuations, ...(value.continuations || {}) },
    sequences: { ...base.sequences, ...(value.sequences || {}) },
    activeSessions: trimActiveSessions(value.activeSessions),
    clock: {
      best: { ...base.clock.best, ...(value.clock?.best || {}) },
      ordinals: { ...base.clock.ordinals, ...(value.clock?.ordinals || {}) },
    },
    streak: { ...base.streak, ...(value.streak || {}) },
    skill: normalizeSkill(value.skill),
    recentPuzzleIds: Array.isArray(value.recentPuzzleIds) ? value.recentPuzzleIds.slice(-RECENT_PUZZLE_LIMIT) : [],
    // Prior palette IDs (forest / DULUX / Pantone sets) are retired in favour of the 诗意中国色 set.
    // Any older preference safely adopts the new 肽白 default; new IDs remain persistent.
    boardTheme: isBoardThemeId(value.boardTheme) ? value.boardTheme : base.boardTheme,
    hints: { remaining: Math.max(0, Math.floor(Number(value.hints?.remaining) || 0)), lastRefillDate: value.hints?.lastRefillDate || null },
    stars: normalizeStars(value.stars),
    records: normalizeRecords(value.records),
    winStreak: Math.max(0, Math.floor(Number(value.winStreak) || 0)),
    achievements: normalizeAchievements(value.achievements),
  };
  return migrated;
}

class ProgressStore {
  constructor({ storage = new WeChatStorageAdapter(), now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
    this.state = migrateState(this.storage.get(STORAGE_KEY));
  }
  save() { return this.storage.set(STORAGE_KEY, this.state); }
  getStateSnapshot() { return JSON.parse(JSON.stringify(this.state)); }
  isCompleted(id) { return Boolean(this.state.completed[id]); }
  wasRecentlyPlayed(id) { return this.state.recentPuzzleIds.includes(id); }
  recordPresented(level) {
    if (!level?.id) return;
    this.state.recentPuzzleIds = [...this.state.recentPuzzleIds.filter((id) => id !== level.id), level.id].slice(-RECENT_PUZZLE_LIMIT);
    this.save();
  }
  nextSequence(key) {
    const ordinal = (this.state.sequences[key] || 0) + 1;
    this.state.sequences[key] = ordinal;
    this.save();
    return ordinal;
  }
  markComplete(level, result) {
    const score = {
      moves: Math.max(0, Number(result.moves) || 0),
      elapsedMs: Math.max(0, Number(result.elapsedMs) || 0),
      undos: Math.max(0, Number(result.undos) || 0),
      hints: Math.max(0, Number(result.hints) || 0),
      errors: Math.max(0, Number(result.errors) || 0),
      maxCombo: Math.max(0, Number(result.maxCombo) || 0),
      points: Math.max(0, Number(result.points) || 0),
      stars: Math.min(3, Math.max(0, Math.floor(Number(result.stars) || 0))),
      completedAt: this.now(),
    };
    const best = this.state.best[level.id];
    // 有分数时按分数比较；否则退回旧规则（步数 → 用时）。
    const isBetter = !best || (score.points && score.points > (best.points || 0)) || (!score.points && (score.moves < best.moves || score.moves === best.moves && score.elapsedMs < best.elapsedMs));
    if (isBetter) this.state.best[level.id] = score;
    this.state.completed[level.id] = { completedAt: score.completedAt };
    if (score.stars) this.state.stars[level.id] = Math.max(this.state.stars[level.id] || 0, score.stars);
    this.updateRecords(level, score);
    this.state.winStreak = (this.state.winStreak || 0) + 1;
    this.state.records.longestWinStreak = Math.max(this.state.records.longestWinStreak, this.state.winStreak);
    if (level.sourceKind === "daily" && level.challengeDate) this.state.daily[level.challengeDate] = { challengeId: level.id, completedAt: score.completedAt };
    const today = chinaDateKey(new Date(score.completedAt));
    if (this.state.streak.lastDate !== today) {
      const previous = chinaDateKey(new Date(score.completedAt - 86400000));
      this.state.streak.count = this.state.streak.lastDate === previous ? this.state.streak.count + 1 : 1;
      this.state.streak.lastDate = today;
    }
    this.state.skill = updateSkill(this.state.skill, level, { ...score, completed: true });
    delete this.state.activeSessions[level.id];
    this.recordPresented(level);
    const achievementEvents = this.recordAchievementCompletion(level, score, result);
    this.save();
    return { ...this.getCompletionSummary(level, score), achievementEvents };
  }
  // 把本局折算成成就上下文，更新累计统计并返回新解锁/升级事件。
  recordAchievementCompletion(level, score, result = {}) {
    const previous = this.state.achievements;
    const rewards = challengeRewardProgress(this.state.completed, this.state.stars);
    const fruit = rewards.find((item) => item.id === "fruit") || { cleared: 0, stars: 0 };
    const space = rewards.find((item) => item.id === "space") || { cleared: 0, stars: 0 };
    const ctx = {
      gridSize: level.gridSize || `${level.rows}x${level.cols}`,
      difficulty: level.difficulty,
      mode: result.mode || (level.sourceKind === "daily" ? "daily" : "standard"),
      elapsedMs: score.elapsedMs, parTimeMs: result.parTimeMs,
      errors: score.errors, undos: score.undos, hints: score.hints, hintTiers: result.hintTiers || [],
      maxCombo: score.maxCombo, stars: score.stars,
      lastWaypointsClean: Boolean(result.lastWaypointsClean),
      firstClear: !previous.stats.completed || !this.state.completed[level.id] || result.firstClear === true,
      winStreak: this.state.winStreak,
      dateKey: chinaDateKey(new Date(score.completedAt)),
      memoryMode: result.memoryMode || (result.mode === "challenge" && level.hidden ? "hidden" : null),
      previewSeconds: result.previewSeconds ?? (result.mode === "challenge" && level.hidden ? Math.round((level.previewMs || 0) / 1000) : undefined),
      flashCombo: result.flashCombo,
      fruitThemeClears: fruit.cleared, spaceThemeClears: space.cleared,
      fruitThemeStars: fruit.stars, spaceThemeStars: space.stars,
      challengeClears: fruit.cleared + space.cleared, challengeStars: fruit.stars + space.stars,
    };
    const stats = applyCompletion(previous.stats, ctx);
    const evaluations = evaluateAll(stats, ctx, previous.unlocked);
    const { unlocked, events } = diffUnlocks(previous.unlocked, evaluations, score.completedAt);
    const titles = unlockedTitles(unlocked);
    const newTitles = titles.filter((id) => !previous.titles.includes(id));
    this.state.achievements = { ...previous, stats, unlocked, titles, equippedTitle: previous.equippedTitle && titles.includes(previous.equippedTitle) ? previous.equippedTitle : previous.equippedTitle };
    this.lastAchievementEvaluations = evaluations;
    return { badges: events, titles: newTitles };
  }
  achievementState() { return normalizeAchievements(this.state.achievements); }
  achievementEvaluations() { return this.lastAchievementEvaluations || evaluateAll(this.state.achievements.stats, {}, this.state.achievements.unlocked); }
  equipTitle(titleId) {
    if (titleId !== null && !this.state.achievements.titles.includes(titleId)) return false;
    this.state.achievements = { ...this.state.achievements, equippedTitle: titleId };
    return this.save();
  }
  equippedTitle() { return this.state.achievements.equippedTitle || null; }
  updateRecords(level, score) {
    const records = this.state.records;
    if (records.fastestMs === null || score.elapsedMs < records.fastestMs) records.fastestMs = score.elapsedMs;
    if (records.fewestErrors === null || score.errors < records.fewestErrors) records.fewestErrors = score.errors;
    const size = level.gridSize || `${level.rows}x${level.cols}`;
    const entry = records.bySize[size] || { fastestMs: null, bestScore: 0, bestStars: 0 };
    records.bySize[size] = {
      fastestMs: entry.fastestMs === null || score.elapsedMs < entry.fastestMs ? score.elapsedMs : entry.fastestMs,
      bestScore: Math.max(entry.bestScore, score.points || 0),
      bestStars: Math.max(entry.bestStars, score.stars || 0),
    };
  }
  getCompletionSummary(level, current) {
    const best = this.state.best[level.id];
    const size = level.gridSize || `${level.rows}x${level.cols}`;
    return {
      current: current || best || { moves: 0, elapsedMs: 0 },
      best: best || current || { moves: 0, elapsedMs: 0 },
      streak: this.state.streak.count || 0,
      winStreak: this.state.winStreak || 0,
      stars: this.state.stars[level.id] || current?.stars || 0,
      sizeRecord: this.state.records.bySize[size] || { fastestMs: null, bestScore: 0, bestStars: 0 },
      completedCount: Object.keys(this.state.completed).length,
      skill: normalizeSkill(this.state.skill),
    };
  }
  records() { return normalizeRecords(this.state.records); }
  starsFor(levelId) { return this.state.stars[levelId] || 0; }
  totalStars() { return Object.values(this.state.stars).reduce((sum, stars) => sum + stars, 0); }
  winStreak() { return this.state.winStreak || 0; }
  breakWinStreak() {
    if (!this.state.winStreak && !this.state.achievements.stats.noUndoRun && !this.state.achievements.stats.memoryRun) return;
    this.state.winStreak = 0;
    this.state.achievements = { ...this.state.achievements, stats: breakRuns(this.state.achievements.stats) };
    this.save();
  }
  // 提示钱包：每天首次访问补足免费额度；消耗与奖励都经这里落盘。
  hintWallet() {
    const today = chinaDateKey(new Date(this.now()));
    const refreshed = normalizeHintWallet(this.state.hints, today);
    if (refreshed.remaining !== this.state.hints.remaining || refreshed.lastRefillDate !== this.state.hints.lastRefillDate) { this.state.hints = refreshed; this.save(); }
    return { ...this.state.hints };
  }
  hintsRemaining() { return this.hintWallet().remaining; }
  canUseHint() { return canUseHint(this.hintWallet()); }
  consumeHint() {
    const wallet = this.hintWallet();
    if (!canUseHint(wallet)) return false;
    this.state.hints = consumeHint(wallet);
    return this.save();
  }
  rewardHints(count) { this.state.hints = rewardHints(this.hintWallet(), count); return this.save(); }
  skillProfile() { return normalizeSkill(this.state.skill); }
  isDailyComplete(level) { return this.state.daily[level.challengeDate]?.challengeId === level.id; }
  nextContinuation(gridSize, difficulty) {
    const key = `${gridSize}:${difficulty}`;
    const ordinal = (this.state.continuations[key] || 0) + 1;
    this.state.continuations[key] = ordinal;
    this.save();
    return ordinal;
  }
  nextClock(tierId) {
    const ordinal = (this.state.clock.ordinals[tierId] || 0) + 1;
    this.state.clock.ordinals[tierId] = ordinal;
    this.save();
    return ordinal;
  }
  recordClockResult(tierId, result) {
    const current = { solved: Math.max(0, Math.floor(result.solved || 0)), remainingMs: Math.max(0, Math.floor(result.remainingMs || 0)), endedAt: this.now() };
    const best = this.state.clock.best[tierId];
    if (!best || current.solved > best.solved || current.solved === best.solved && current.remainingMs > best.remainingMs) this.state.clock.best[tierId] = current;
    this.save();
    return { current, best: this.state.clock.best[tierId] };
  }
  clockBest(tierId) { return this.state.clock.best[tierId] || { solved: 0, remainingMs: 0 }; }
  saveActiveSession(level, engineState, mode = "standard") {
    if (!level?.id || !engineState) return false;
    this.state.activeSessions = trimActiveSessions({ ...this.state.activeSessions, [level.id]: { level, engineState, mode, updatedAt: this.now() } });
    return this.save();
  }
  activeSessionCount() { return Object.keys(this.state.activeSessions).length; }
  loadActiveSession(levelId) { return this.state.activeSessions[levelId]?.engineState || null; }
  loadLatestSession({ mode, gridSize, difficulty } = {}) {
    return Object.values(this.state.activeSessions).filter((session) => (!mode || session.mode === mode) && (!gridSize || session.level?.gridSize === gridSize) && (!difficulty || session.level?.difficulty === difficulty)).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  }
  clearActiveSession(levelId) { delete this.state.activeSessions[levelId]; return this.save(); }
  setSoundEnabled(enabled) { this.state.soundEnabled = Boolean(enabled); this.save(); }
  soundEnabled() { return this.state.soundEnabled !== false; }
  setBoardTheme(themeId) { if (!isBoardThemeId(themeId) || !this.isBoardThemeUnlocked(themeId)) return false; this.state.boardTheme = themeId; return this.save(); }
  isBoardThemeUnlocked(themeId) {
    const theme = BOARD_THEMES.find((item) => item.id === themeId);
    if (!theme?.unlock?.challengeTheme) return true;
    return this.challengeProgress().find((item) => item.id === theme.unlock.challengeTheme)?.complete === true;
  }
  challengeProgress() { return challengeRewardProgress(this.state.completed, this.state.stars); }
  boardThemeUnlocks() { return Object.fromEntries(BOARD_THEMES.map((theme) => [theme.id, this.isBoardThemeUnlocked(theme.id)])); }
  boardTheme() {
    const id = isBoardThemeId(this.state.boardTheme) ? this.state.boardTheme : DEFAULT_BOARD_THEME_ID;
    return this.isBoardThemeUnlocked(id) ? id : DEFAULT_BOARD_THEME_ID;
  }
}

module.exports = { ACTIVE_SESSION_LIMIT, ProgressStore, RECENT_PUZZLE_LIMIT, STATE_VERSION, STORAGE_KEY, emptyState, migrateState };
