const { TrailEngine } = require("./TrailEngine");
const { SingleBoardRenderer } = require("./SingleBoardRenderer");
const { ProgressStore } = require("./ProgressStore");
const { SoundFx } = require("./SoundFx");
const { LeaderboardService } = require("./LeaderboardService");
const { HybridLevelProvider } = require("./providers/HybridLevelProvider");
const { CLOCK_TIERS } = require("./modes/ModeCatalog");
const { DEFAULT_BOARD_THEME_ID } = require("./themes/BoardThemes");
const { comboLabel, completionLabels, liveScore, scoreBreakdown, starsFor } = require("./scoring/ScoreSystem");
const { PERFECT_CLEAR_REWARD, hintTierFor, planHint } = require("./scoring/HintPolicy");
const { CALM_FINISH_WAYPOINTS } = require("./achievements/AchievementTracker");
const { BADGES, CATEGORIES, TIER_LABELS, TITLES, badgeById } = require("./achievements/BadgeCatalog");

const LABELS = { easy: "简单", medium: "中等", hard: "困难", expert: "专家" };
const CLOCK_DURATION_MS = 60000;
const CLOCK_BONUS_MS = 8000;
const UI_TICK_MS = 500;
const WEATHER_ACTIVE_MS = 33;
const WEATHER_IDLE_MS = 120;
const HINT_DISPLAY_MS = 2200;
const FEEDBACK_FLASH_MS = 700;
const COMBO_TOAST_MIN = 5;
const COMPLETION_MODAL_MODES = ["standard", "daily", "progressive"];

function pointFrom(event) {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  return touch ? { x: touch.clientX ?? touch.x ?? touch.pageX, y: touch.clientY ?? touch.y ?? touch.pageY } : null;
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

class ForestTrailMiniGame {
  constructor(canvas, levels = [], services = {}) {
    this.canvas = canvas;
    this.progress = services.progress || new ProgressStore();
    this.sound = services.sound || new SoundFx(this.progress.soundEnabled());
    this.leaderboard = services.leaderboard || new LeaderboardService();
    this.renderer = services.renderer || new SingleBoardRenderer(canvas);
    this.levelProvider = services.levelProvider || new HybridLevelProvider({ curatedLevels: levels, catalog: services.catalog || null, progress: this.progress });
    this.gridSize = "6x6";
    this.difficulty = "easy";
    this.mode = "standard";
    this.progressiveLevel = this.progress.progressiveLevel?.() || 1;
    this.dragCell = null;
    this.startedAt = Date.now();
    this.clock = null;
    this.clockSetupVisible = false;
    this.clockResult = null;
    this.infoVisible = false;
    this.themePickerVisible = false;
    this.undoCount = 0;
    this.hintCount = 0;
    const resumable = this.progress.loadLatestSession?.({ mode: "standard", gridSize: this.gridSize, difficulty: this.difficulty });
    this.current = resumable?.level || this.pickRandom();
    this.start(this.current, resumable?.engineState);
    this.sound.startBackgroundMusic();
    this.uiTimer = setInterval(() => this.tickUi(), UI_TICK_MS);
    this.weatherEnabled = services.weatherEnabled !== false;
    this.weatherPaused = false;
    this.scheduleWeatherFrame();
    this.bindLifecycle();
    Promise.resolve(this.leaderboard.initialize()).finally(() => this.render());
  }

  tickUi() {
    if (this.mode !== "standard" && this.mode !== "daily" && this.mode !== "progressive") return;
    if (this.engine?.getSnapshot().status === "completed") return;
    this.render();
  }

  // 天气动画：雨/雾阶段 ~30fps，晴光阶段降到低频，只依赖渲染器上一帧的场景判断。
  weatherFrameDelay() {
    const scene = this.renderer.weatherScene;
    if (!scene) return WEATHER_IDLE_MS;
    return scene.rain > 0 || scene.mist > 0 ? WEATHER_ACTIVE_MS : WEATHER_IDLE_MS;
  }

  scheduleWeatherFrame() {
    if (this.weatherTimer) clearTimeout(this.weatherTimer);
    this.weatherTimer = null;
    if (!this.weatherEnabled || this.weatherPaused) return;
    this.weatherTimer = setTimeout(() => { this.weatherTimer = null; this.render(); this.scheduleWeatherFrame(); }, this.weatherFrameDelay());
  }

  bindLifecycle() {
    if (typeof wx === "undefined") return;
    try {
      wx.onHide?.(() => { this.weatherPaused = true; this.scheduleWeatherFrame(); });
      wx.onShow?.(() => { this.weatherPaused = false; this.scheduleWeatherFrame(); });
    } catch (_) { /* lifecycle hooks are best-effort */ }
  }

  pickRandom(excludeId) {
    return this.levelProvider.nextUnlimited({ gridSize: this.gridSize, difficulty: this.difficulty, excludeId });
  }

  pickClockLevel() {
    return this.levelProvider.clock(this.clock?.tierId || "easy", this.clock?.solved || 0);
  }

  startCompletionEffects() {
    if (!this.renderer.startCompletionFireworks) return;
    this.stopCompletionEffects();
    this.renderer.startCompletionFireworks(Date.now());
    const animate = () => {
      if (this.completionDismissed || this.engine?.getSnapshot().status !== "completed" || !this.renderer.completionFireworks) {
        this.stopCompletionEffects();
        return;
      }
      this.render();
      this.completionEffectTimer = setTimeout(animate, 33);
    };
    animate();
  }

  stopCompletionEffects() {
    if (this.completionEffectTimer) clearTimeout(this.completionEffectTimer);
    this.completionEffectTimer = null;
    this.renderer.clearCompletionFireworks?.();
  }

  start(level, restoredState) {
    this.stopCompletionEffects();
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    this.feedback = null;
    // 离开一道未完成的题时清掉它的存档，避免 activeSessions 随换题无限增长；
    // 已经落过脚印又放弃，视为连胜中断。
    if (this.current && this.current.id !== level.id && this.engine?.getSnapshot().status !== "completed") {
      this.progress.clearActiveSession?.(this.current.id);
      if (this.engine?.getSnapshot().path.length > 0) this.progress.breakWinStreak?.();
    }
    this.current = level;
    this.wasCompleted = false;
    this.dragCell = null;
    this.completionSummary = null;
    this.completionDismissed = false;
    this.startedAt = Date.now();
    this.completedAt = null;
    this.undoCount = 0;
    this.hintCount = 0;
    this.hintTiers = [];
    this.errorsAtWaypoint = {};
    this.lastPersistedPathLength = -1;
    this.renderer.setLevel(level);
    this.engine = new TrailEngine(level);
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.mode !== "clock") {
      const saved = restoredState || this.progress.loadActiveSession?.(level.id);
      if (saved && this.engine.restoreState(saved) && Number.isFinite(saved.elapsedMs)) this.startedAt = Date.now() - Math.max(0, saved.elapsedMs);
    }
    this.unsubscribe = this.engine.subscribe((snapshot) => {
      if (this.mode !== "clock" && snapshot.status !== "completed" && snapshot.path.length !== this.lastPersistedPathLength) {
        this.lastPersistedPathLength = snapshot.path.length;
        if (snapshot.path.length === 0) this.progress.clearActiveSession?.(level.id);
        else this.progress.saveActiveSession?.(level, { ...this.engine.serializeState(), elapsedMs: Date.now() - this.startedAt }, this.mode);
      }
      if (snapshot.status === "completed" && !this.wasCompleted) {
        this.wasCompleted = true;
        this.completedAt = Date.now();
        if (this.mode === "clock" && this.clock) return this.completeClockLevel(snapshot);
        const stats = this.completionStats(snapshot);
        const breakdown = scoreBreakdown(level, stats);
        const stars = starsFor(level, stats);
        this.completionSummary = {
          ...this.progress.markComplete(level, {
            ...stats, moves: snapshot.moves, points: breakdown.total, stars,
            mode: this.mode, parTimeMs: breakdown.parTimeMs, hintTiers: [...this.hintTiers], lastWaypointsClean: this.lastWaypointsClean(snapshot),
          }),
          breakdown, stars, labels: completionLabels(level, stats), stats,
        };
        this.completionSummary.nextGoals = this.nearestBadgeGoals();
        if (this.completionSummary.achievementEvents?.badges?.length) this.vibrate("short");
        if (stars === 3) { this.progress.rewardHints?.(PERFECT_CLEAR_REWARD); this.completionSummary.hintReward = PERFECT_CLEAR_REWARD; }
        this.startCompletionEffects();
        this.sound.playCompletionCelebration();
        this.vibrate("long");
        Promise.resolve(this.leaderboard.submitCompletion(level, this.completionSummary.current)).finally(() => this.render());
      }
      this.render(snapshot);
    });
  }

  completionStats(snapshot = this.engine.getSnapshot()) {
    return {
      elapsedMs: (this.completedAt || Date.now()) - this.startedAt,
      errors: snapshot.errors || 0,
      undos: this.undoCount,
      hints: this.hintCount,
      maxCombo: snapshot.maxCombo || 0,
      // 会话内连胜：本局若完成则是 winStreak + 1，用于结算奖励。
      winStreak: (this.progress.winStreak?.() || 0) + 1,
    };
  }

  // 最后 N 个数字期间（从倒数第 N 个数字成为目标起）是否零错误。
  lastWaypointsClean(snapshot = this.engine.getSnapshot()) {
    const total = snapshot.totalWaypoints || 0;
    if (total < CALM_FINISH_WAYPOINTS) return false;
    for (let number = total - CALM_FINISH_WAYPOINTS + 1; number <= total; number += 1) if (this.errorsAtWaypoint[number]) return false;
    return true;
  }

  nearestBadgeGoals(limit = 2) {
    const evaluations = this.progress.achievementEvaluations?.() || {};
    return Object.values(evaluations)
      .filter((evaluation) => evaluation.next && (evaluation.value > 0 || evaluation.tier))
      .sort((a, b) => a.next.remaining - b.next.remaining || a.next.target - b.next.target)
      .slice(0, limit)
      .map((evaluation) => ({ id: evaluation.id, name: badgeById(evaluation.id)?.name || evaluation.id, tier: evaluation.next.tier, tierLabel: TIER_LABELS[evaluation.next.tier], remaining: evaluation.next.remaining, target: evaluation.next.target, value: evaluation.value }));
  }

  badgeSummary() {
    const state = this.progress.achievementState?.() || { unlocked: {}, equippedTitle: null };
    return { unlocked: Object.keys(state.unlocked).length, total: BADGES.length, title: TITLES.find((title) => title.id === state.equippedTitle)?.name || null };
  }

  // 徽章图鉴视图：24 枚徽章的名称 / 类别 / 当前等级 / 下一档进度 / 是否锁定。
  badgeCollection() {
    const state = this.progress.achievementState?.() || { unlocked: {}, titles: [], equippedTitle: null };
    const evaluations = this.progress.achievementEvaluations?.() || {};
    const badges = BADGES.map((badge) => {
      const unlocked = state.unlocked[badge.id] || null, evaluation = evaluations[badge.id] || { value: 0, tier: null, next: badge.tiers[0] ? { tier: badge.tiers[0].tier, target: badge.tiers[0].target, remaining: badge.tiers[0].target } : null };
      return { id: badge.id, name: badge.name, icon: badge.icon, category: badge.category, categoryLabel: CATEGORIES[badge.category].label, shape: CATEGORIES[badge.category].shape, color: CATEGORIES[badge.category].color, hint: badge.hint, tier: unlocked?.tier || null, tierLabel: unlocked ? TIER_LABELS[unlocked.tier] : null, unlockedAt: unlocked?.unlockedAt || null, count: evaluation.value, next: evaluation.next, describe: badge.tiers.find((step) => step.tier === (unlocked?.tier || badge.tiers[0].tier))?.describe || badge.hint };
    });
    const titles = TITLES.map((title) => ({ id: title.id, name: title.name, condition: title.condition, unlocked: state.titles.includes(title.id), equipped: state.equippedTitle === title.id }));
    return { badges, titles, unlockedCount: badges.filter((badge) => badge.tier).length, total: badges.length, equippedTitle: titles.find((title) => title.equipped)?.name || null };
  }

  vibrate(kind = "short") {
    if (typeof wx === "undefined" || !this.progress.soundEnabled()) return;
    try { (kind === "long" ? wx.vibrateLong : wx.vibrateShort)?.({ type: "light" }); } catch (_) { /* haptics are best-effort */ }
  }

  completeClockLevel(snapshot) {
    if (Date.now() >= this.clock.endAt) return this.finishClock();
    this.progress.markComplete(this.current, { moves: snapshot.moves, elapsedMs: Date.now() - this.startedAt, undos: this.undoCount, hints: this.hintCount });
    const tier = CLOCK_TIERS[this.clock.tierId] || CLOCK_TIERS.easy;
    this.clock.solved += 1;
    this.clock.endAt += tier.bonusMs || CLOCK_BONUS_MS;
    this.sound.complete();
    this.start(this.pickClockLevel());
    this.render();
  }

  startClock(tierId) {
    const tier = CLOCK_TIERS[tierId] || CLOCK_TIERS.easy;
    this.stopClock();
    this.mode = "clock";
    this.gridSize = tier.gridSize;
    this.difficulty = tier.difficulty;
    this.clockSetupVisible = false;
    this.clockResult = null;
    this.clock = { tierId: tier.id, startedAt: Date.now(), endAt: Date.now() + CLOCK_DURATION_MS, solved: 0 };
    this.sound.tap();
    this.start(this.pickClockLevel());
    this.clockTimer = setInterval(() => this.tickClock(), 250);
    this.render();
  }

  startDaily(date = new Date()) {
    this.stopClock();
    this.mode = "daily";
    this.clock = null;
    this.clockResult = null;
    const level = this.levelProvider.daily(date);
    this.gridSize = level.gridSize;
    this.difficulty = level.difficulty;
    this.start(level);
  }

  startProgressive(levelNumber = this.progressiveLevel) {
    this.stopClock();
    this.mode = "progressive";
    this.clock = null;
    this.clockResult = null;
    this.progressiveLevel = Math.max(1, Math.floor(levelNumber));
    this.progress.setProgressiveLevel?.(this.progressiveLevel);
    const level = this.levelProvider.progressive(this.progressiveLevel);
    this.gridSize = level.gridSize;
    this.difficulty = level.difficulty;
    this.start(level);
  }

  nextAfterCompletion() {
    if (this.mode === "progressive") return this.startProgressive(this.progressiveLevel + 1);
    return this.selectStandard();
  }

  stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  tickClock() {
    if (this.mode !== "clock" || !this.clock) return;
    if (Date.now() >= this.clock.endAt) return this.finishClock();
    this.render();
  }

  finishClock() {
    if (this.mode !== "clock" || !this.clock) return;
    const tier = CLOCK_TIERS[this.clock.tierId] || CLOCK_TIERS.easy;
    const result = { solved: this.clock.solved, remainingMs: Math.max(0, this.clock.endAt - Date.now()) };
    this.stopClock();
    this.mode = "clock-ended";
    this.clockResult = { tier, ...this.progress.recordClockResult(tier.id, result) };
    Promise.resolve(this.leaderboard.submitClockResult(tier, this.clockResult.current)).finally(() => this.render());
    this.render();
  }

  clockRemainingMs() {
    return this.mode === "clock" && this.clock ? Math.max(0, this.clock.endAt - Date.now()) : 0;
  }

  view(snapshot = this.engine.getSnapshot()) {
    const tier = CLOCK_TIERS[this.clock?.tierId] || this.clockResult?.tier;
    return {
      mode: this.mode,
      progressiveLevel: this.progressiveLevel,
      clockActive: this.mode === "clock",
      clockSetupVisible: this.clockSetupVisible,
      infoVisible: this.infoVisible,
      themePickerVisible: this.themePickerVisible,
      friendBoardVisible: Boolean(this.friendBoardVisible),
      friendBoardTitle: this.friendBoardTitle || "好友榜",
      friendBoardCanvas: this.friendBoardVisible ? this.leaderboard.friendBoardCanvas?.() || null : null,
      badgesVisible: Boolean(this.badgesVisible),
      badgePage: this.badgePage || "badges",
      badgeScroll: this.badgeScroll || 0,
      badgeCollection: this.badgesVisible ? this.badgeCollection() : null,
      achievementStats: this.badgesVisible ? this.progress.achievementState?.()?.stats || null : null,
      records: this.badgesVisible ? this.progress.records?.() || null : null,
      totalStars: this.badgesVisible ? this.progress.totalStars?.() || 0 : 0,
      badgeSummary: this.badgeSummary(),
      badgeLookup: (id) => { const badge = badgeById(id); return badge ? { id: badge.id, name: badge.name, icon: badge.icon, shape: CATEGORIES[badge.category].shape, color: CATEGORIES[badge.category].color } : null; },
      boardTheme: this.progress.boardTheme?.() || DEFAULT_BOARD_THEME_ID,
      weatherEnabled: this.weatherEnabled !== false,
      clockEnded: this.mode === "clock-ended" && Boolean(this.clockResult),
      clockTier: tier,
      clockTiers: Object.values(CLOCK_TIERS),
      clockRemainingMs: this.clockRemainingMs(),
      clockSolved: this.clock?.solved || this.clockResult?.current?.solved || 0,
      clockResult: this.clockResult,
      gridSize: this.gridSize,
      difficulty: this.difficulty,
      difficultyLabel: tier?.label || LABELS[this.difficulty],
      sound: this.progress.soundEnabled(),
      skill: this.progress.skillProfile?.(),
      points: snapshot.status === "completed" && this.completionSummary?.breakdown ? this.completionSummary.breakdown.total : liveScore(this.current, { ...this.completionStats(snapshot), winStreak: 0 }, snapshot.path.length),
      status: {
        currentWaypoint: Math.min(snapshot.totalWaypoints || 0, Math.max(0, (snapshot.nextWaypoint || 1) - 1)),
        totalWaypoints: snapshot.totalWaypoints || 0,
        errors: snapshot.errors || 0,
        combo: snapshot.combo || 0,
        hintsRemaining: this.progress.hintsRemaining?.() ?? 0,
        bestMs: this.progress.getCompletionSummary(this.current).best?.elapsedMs || null,
      },
      feedback: this.feedback || null,
      hintCells: snapshot.hintCells || [],
      time: this.mode === "clock" ? formatTime(this.clockRemainingMs()) : formatTime((this.completedAt || Date.now()) - this.startedAt),
      completion: this.completionSummary || this.progress.getCompletionSummary(this.current),
      completionVisible: this.isCompletionModalVisible(snapshot),
      rankings: this.leaderboard.status(),
    };
  }

  isCompletionModalVisible(snapshot = this.engine.getSnapshot()) {
    return snapshot.status === "completed" && !this.completionDismissed && COMPLETION_MODAL_MODES.includes(this.mode);
  }

  render(snapshot = this.engine.getSnapshot()) { this.renderer.render(snapshot, this.view(snapshot)); }

  selectStandard(gridSize = this.gridSize, difficulty = this.difficulty) {
    this.stopClock();
    this.mode = "standard";
    this.clock = null;
    this.clockResult = null;
    this.gridSize = gridSize;
    this.difficulty = difficulty;
    this.sound.tap();
    this.start(this.pickRandom(this.current?.id));
  }

  moveTo(cell) {
    const expectedWaypoint = this.engine.nextWaypoint;
    const errorsBefore = this.engine.errors;
    if (!this.engine.tryMove(cell)) {
      if (this.engine.errors > errorsBefore) { this.errorsAtWaypoint[expectedWaypoint] = (this.errorsAtWaypoint[expectedWaypoint] || 0) + 1; this.flash({ kind: "error", cell }); this.vibrate("short"); }
      return false;
    }
    if (this.hintTimer) this.clearHintDisplay();
    const snapshot = this.engine.getSnapshot();
    if (this.engine.numberAt(cell) === expectedWaypoint) {
      this.sound.coin();
      const label = snapshot.combo >= COMBO_TOAST_MIN ? comboLabel(snapshot.combo) : null;
      this.flash({ kind: "waypoint", cell, text: label || `${expectedWaypoint} / ${snapshot.totalWaypoints}` });
    } else if (snapshot.combo >= COMBO_TOAST_MIN && snapshot.combo % COMBO_TOAST_MIN === 0) {
      this.flash({ kind: "combo", cell, text: comboLabel(snapshot.combo) });
    }
    return true;
  }

  // 短暂的操作反馈（错误红闪 / 连击提示），到期后自动清除并重绘。
  flash(feedback) {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.feedback = { ...feedback, at: Date.now() };
    this.flashTimer = setTimeout(() => { this.flashTimer = null; this.feedback = null; this.render(); }, FEEDBACK_FLASH_MS);
  }

  useHint() {
    const snapshot = this.engine.getSnapshot();
    if (snapshot.status === "completed" || this.mode === "clock" || this.mode === "clock-ended") return false;
    if (!this.progress.canUseHint?.()) { this.flash({ kind: "notice", text: "今日提示已用完" }); this.render(); return false; }
    const tier = hintTierFor(this.hintCount);
    const plan = planHint(this.current, snapshot.path, tier);
    if (!plan) return false;
    this.progress.consumeHint?.();
    this.hintCount += 1;
    this.hintTiers.push(tier);
    if (plan.autoMoves?.length) {
      for (const cell of plan.autoMoves) if (!this.engine.tryMove(cell)) break;
      this.engine.showHintCells([], plan.message);
    } else {
      this.engine.showHintCells(plan.cells, plan.message);
    }
    this.sound.tap();
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.clearHintDisplay(), HINT_DISPLAY_MS);
    this.render();
    return true;
  }

  clearHintDisplay() {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.engine.clearHint();
  }

  openFriendBoard({ clock = false } = {}) {
    const opened = this.leaderboard.openFriendBoard({ clock, ...this.renderer.friendBoardCanvasSize?.() });
    if (!opened) {
      try { wx?.showToast?.({ title: "好友排名待微信授权", icon: "none" }); } catch (_) {}
      return this.render();
    }
    this.friendBoardVisible = true;
    this.friendBoardTitle = clock ? "时间挑战好友榜" : "好友榜";
    this.sound.tap();
    if (this.friendBoardTimer) clearInterval(this.friendBoardTimer);
    // 开放数据域异步绘制到 sharedCanvas，主域需要持续把它贴到屏幕上。
    this.friendBoardTimer = setInterval(() => this.render(), 250);
    return this.render();
  }

  openBadges() {
    this.badgesVisible = true;
    this.badgePage = this.badgePage || "badges";
    this.badgeScroll = 0;
    this.sound.tap();
    return this.render();
  }

  closeFriendBoard() {
    if (this.friendBoardTimer) clearInterval(this.friendBoardTimer);
    this.friendBoardTimer = null;
    this.friendBoardVisible = false;
    this.sound.tap();
  }

  undo() { this.undoCount += 1; this.engine.undo(); this.sound.undo(); }
  reset() { this.engine.reset(); this.sound.reset(); }

  handleStart(event) {
    const point = pointFrom(event);
    if (!point) return;
    const controls = this.renderer.controls;
    if (this.themePickerVisible) {
      const selectedTheme = controls.themeOptions?.find((item) => this.renderer.hit(item, point));
      if (selectedTheme) { this.progress.setBoardTheme?.(selectedTheme.id); this.themePickerVisible = false; this.sound.tap(); return this.render(); }
      if (this.renderer.hit(controls.themeClose, point)) { this.themePickerVisible = false; this.sound.tap(); return this.render(); }
      return;
    }
    if (this.infoVisible) {
      if (this.renderer.hit(controls.infoClose, point) || this.renderer.hit(controls.infoDismiss, point)) { this.infoVisible = false; this.sound.tap(); return this.render(); }
      return;
    }
    if (this.renderer.hit(controls.info, point)) { this.infoVisible = true; this.sound.tap(); return this.render(); }
    if (this.renderer.hit(controls.theme, point)) { this.themePickerVisible = true; this.sound.tap(); return this.render(); }
    if (this.renderer.hit(controls.badges, point)) return this.openBadges();
    if (this.renderer.hit(controls.sound, point)) {
      this.progress.setSoundEnabled(!this.progress.soundEnabled());
      this.sound.setEnabled(this.progress.soundEnabled());
      if (this.progress.soundEnabled()) this.sound.tap();
      return this.render();
    }
    if (this.clockSetupVisible) {
      const tier = controls.clockTiers?.find((item) => this.renderer.hit(item, point));
      if (tier) return this.startClock(tier.id);
      if (this.renderer.hit(controls.clockCancel, point)) { this.clockSetupVisible = false; return this.render(); }
      return;
    }
    if (this.friendBoardVisible) {
      if (this.renderer.hit(controls.friendBoardClose, point)) { this.closeFriendBoard(); return this.render(); }
      return;
    }
    if (this.badgesVisible) {
      if (this.renderer.hit(controls.badgesClose, point)) { this.badgesVisible = false; this.sound.tap(); return this.render(); }
      const tab = controls.badgeTabs?.find((item) => this.renderer.hit(item, point));
      if (tab) { this.badgePage = tab.id; this.sound.tap(); return this.render(); }
      const title = controls.badgeTitles?.find((item) => this.renderer.hit(item, point));
      if (title?.unlocked) { this.progress.equipTitle?.(title.equipped ? null : title.id); this.sound.tap(); return this.render(); }
      if (this.renderer.hit(controls.badgePageNext, point)) { this.badgeScroll = (this.badgeScroll || 0) + 1; return this.render(); }
      if (this.renderer.hit(controls.badgePagePrev, point)) { this.badgeScroll = Math.max(0, (this.badgeScroll || 0) - 1); return this.render(); }
      return;
    }
    if (this.mode === "clock-ended") {
      if (this.renderer.hit(controls.clockRestart, point)) return this.startClock(this.clockResult.tier.id);
      if (this.renderer.hit(controls.clockClose, point)) { this.sound.tap(); return this.selectStandard(); }
      if (this.renderer.hit(controls.clockLeaderboard, point)) return this.openFriendBoard({ clock: true });
      return;
    }
    const completed = this.engine.getSnapshot().status === "completed";
    if (this.isCompletionModalVisible()) {
      if (this.renderer.hit(controls.close, point)) { this.completionDismissed = true; this.stopCompletionEffects(); return this.render(); }
      if (this.renderer.hit(controls.next, point)) return this.nextAfterCompletion();
      if (this.renderer.hit(controls.leaderboard, point)) return this.openFriendBoard();
      if (this.renderer.hit(controls.viewBadges, point)) return this.openBadges();
      if (this.renderer.hit(controls.clock, point)) { this.completionDismissed = true; this.clockSetupVisible = true; this.sound.tap(); return this.render(); }
      return;
    }
    if (!completed && this.renderer.hit(controls.undo, point)) return this.undo();
    if (!completed && this.renderer.hit(controls.reset, point)) return this.reset();
    if (this.renderer.hit(controls.clock, point)) { this.clockSetupVisible = true; this.sound.tap(); return this.render(); }
    if (this.renderer.hit(controls.daily, point)) return this.startDaily();
    if (this.renderer.hit(controls.progressive, point)) return this.startProgressive(this.progressiveLevel);
    const difficulty = controls.difficulties?.find((item) => this.renderer.hit(item, point));
    if (difficulty) return this.selectStandard(this.gridSize, difficulty.id);
    const size = controls.sizes?.find((item) => this.renderer.hit(item, point));
    if (size) return this.selectStandard(size.id, this.difficulty);
    const cell = this.renderer.toCell(point);
    if (cell && this.moveTo(cell)) this.dragCell = `${cell.row}:${cell.col}`;
  }

  handleMove(event) {
    const point = pointFrom(event);
    if (!point || this.infoVisible || this.themePickerVisible || this.friendBoardVisible || this.badgesVisible || this.engine.getSnapshot().status === "completed" || this.clockSetupVisible || this.mode === "clock-ended") return;
    const cell = this.renderer.toCell(point);
    if (!cell) return;
    const key = `${cell.row}:${cell.col}`;
    if (key === this.dragCell) return;
    if (this.moveTo(cell)) this.dragCell = key;
  }

  handleEnd() { this.dragCell = null; }
  resize() { this.renderer.resize(); this.render(); }
  destroy() {
    this.stopClock();
    this.stopCompletionEffects();
    if (this.uiTimer) clearInterval(this.uiTimer);
    this.uiTimer = null;
    if (this.weatherTimer) clearTimeout(this.weatherTimer);
    this.weatherTimer = null;
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    if (this.friendBoardTimer) clearInterval(this.friendBoardTimer);
    this.friendBoardTimer = null;
    this.unsubscribe?.();
    this.sound.destroy?.();
  }
}

module.exports = { CLOCK_BONUS_MS, CLOCK_DURATION_MS, CLOCK_TIERS, COMPLETION_MODAL_MODES, ForestTrailMiniGame, UI_TICK_MS, WEATHER_ACTIVE_MS, WEATHER_IDLE_MS, formatTime };
