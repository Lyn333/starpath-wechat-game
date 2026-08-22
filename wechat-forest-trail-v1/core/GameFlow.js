const { TrailEngine } = require("./TrailEngine");
const { SingleBoardRenderer } = require("./SingleBoardRenderer");
const { ProgressStore } = require("./ProgressStore");
const { SoundFx } = require("./SoundFx");
const { LeaderboardService } = require("./LeaderboardService");
const { CLOCK_TIERS, createContinuation, createClockLevel } = require("./DailyChallenge");

const SIZES = ["6x6", "8x8", "10x10", "12x12"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const LABELS = { easy: "简单", medium: "中等", hard: "困难" };
const CLOCK_DURATION_MS = 60000;
const CLOCK_BONUS_MS = 8000;

function pointFrom(event) { const touch = event.touches?.[0] || event.changedTouches?.[0]; return touch ? { x: touch.clientX ?? touch.x ?? touch.pageX, y: touch.clientY ?? touch.y ?? touch.pageY } : null; }
function shuffle(items, random = Math.random) { return [...items].sort(() => random() - .5); }
function formatTime(ms) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

class ForestTrailMiniGame {
  constructor(canvas, levels) {
    this.canvas = canvas; this.levels = levels; this.progress = new ProgressStore(); this.sound = new SoundFx(this.progress.soundEnabled()); this.leaderboard = new LeaderboardService();
    this.renderer = new SingleBoardRenderer(canvas); this.gridSize = "6x6"; this.difficulty = "easy"; this.mode = "standard"; this.dragCell = null; this.startedAt = Date.now(); this.clock = null; this.clockSetupVisible = false; this.clockResult = null; this.current = this.pickRandom(); this.start(this.current); this.sound.startBackgroundMusic(); this.leaderboard.initialize().finally(() => this.render());
  }
  pickRandom(excludeId) {
    const choices = this.levels.filter((level) => level.gridSize === this.gridSize && level.difficulty === this.difficulty && level.id !== excludeId && !this.progress.isCompleted(level.id));
    if (choices.length) return shuffle(choices)[0];
    return createContinuation(this.gridSize, this.difficulty, this.progress.nextContinuation(this.gridSize, this.difficulty));
  }
  pickClockLevel(excludeId) {
    const tier = CLOCK_TIERS[this.clock?.tierId] || CLOCK_TIERS.easy;
    const choices = this.levels.filter((level) => level.gridSize === tier.gridSize && level.difficulty === tier.difficulty && level.id !== excludeId);
    if (choices.length) return shuffle(choices)[0];
    return createClockLevel(tier.id, this.progress.nextClock(tier.id));
  }
  start(level) {
    this.current = level; this.wasCompleted = false; this.dragCell = null; this.completionSummary = null; this.completionDismissed = false; this.startedAt = Date.now(); this.renderer.setLevel(level); this.engine = new TrailEngine(level);
    this.unsubscribe?.(); this.unsubscribe = this.engine.subscribe((snapshot) => {
      if (snapshot.status === "completed" && !this.wasCompleted) {
        this.wasCompleted = true;
        if (this.mode === "clock" && this.clock) return this.completeClockLevel(snapshot);
        this.completionSummary = this.progress.markComplete(level, { moves: snapshot.moves, elapsedMs: Date.now() - this.startedAt });
        this.sound.complete(); this.leaderboard.submitCompletion(level, this.completionSummary.current).finally(() => this.render());
      }
      this.render(snapshot);
    });
  }
  completeClockLevel(snapshot) {
    if (Date.now() >= this.clock.endAt) return this.finishClock();
    this.progress.markComplete(this.current, { moves: snapshot.moves, elapsedMs: Date.now() - this.startedAt });
    this.clock.solved += 1; this.clock.endAt += CLOCK_BONUS_MS; this.sound.complete(); this.start(this.pickClockLevel(this.current.id)); this.render();
  }
  startClock(tierId) {
    const tier = CLOCK_TIERS[tierId] || CLOCK_TIERS.easy; this.stopClock(); this.mode = "clock"; this.gridSize = tier.gridSize; this.difficulty = tier.difficulty; this.clockSetupVisible = false; this.clockResult = null;
    this.clock = { tierId: tier.id, startedAt: Date.now(), endAt: Date.now() + CLOCK_DURATION_MS, solved: 0 };
    this.sound.tap(); this.start(this.pickClockLevel()); this.clockTimer = setInterval(() => this.tickClock(), 250); this.render();
  }
  stopClock() { if (this.clockTimer) clearInterval(this.clockTimer); this.clockTimer = null; }
  tickClock() { if (this.mode !== "clock" || !this.clock) return; if (Date.now() >= this.clock.endAt) return this.finishClock(); this.render(); }
  finishClock() {
    if (this.mode !== "clock" || !this.clock) return; const tier = CLOCK_TIERS[this.clock.tierId] || CLOCK_TIERS.easy; const result = { solved: this.clock.solved, remainingMs: Math.max(0, this.clock.endAt - Date.now()) };
    this.stopClock(); this.mode = "clock-ended"; this.clockResult = { tier, ...this.progress.recordClockResult(tier.id, result) }; this.leaderboard.submitClockResult(tier, this.clockResult.current).finally(() => this.render()); this.render();
  }
  clockRemainingMs() { return this.mode === "clock" && this.clock ? Math.max(0, this.clock.endAt - Date.now()) : 0; }
  view(snapshot = this.engine.getSnapshot()) {
    const tier = CLOCK_TIERS[this.clock?.tierId] || this.clockResult?.tier;
    return { clockActive: this.mode === "clock", clockSetupVisible: this.clockSetupVisible, clockEnded: this.mode === "clock-ended" && Boolean(this.clockResult), clockTier: tier, clockTiers: Object.values(CLOCK_TIERS), clockRemainingMs: this.clockRemainingMs(), clockSolved: this.clock?.solved || this.clockResult?.current?.solved || 0, clockResult: this.clockResult, gridSize: this.gridSize, difficulty: this.difficulty, difficultyLabel: tier?.label || LABELS[this.difficulty], sound: this.progress.soundEnabled(), points: snapshot.status === "completed" ? Math.max(10, Math.round(1200 / Math.max(1, snapshot.moves))) : 0, time: this.mode === "clock" ? formatTime(this.clockRemainingMs()) : formatTime(Date.now() - this.startedAt), completion: this.completionSummary || this.progress.getCompletionSummary(this.current), completionVisible: snapshot.status === "completed" && !this.completionDismissed && this.mode === "standard", rankings: this.leaderboard.status() };
  }
  render(snapshot = this.engine.getSnapshot()) { this.renderer.render(snapshot, this.view(snapshot)); }
  selectStandard(gridSize = this.gridSize, difficulty = this.difficulty) { this.stopClock(); this.mode = "standard"; this.clock = null; this.clockResult = null; this.gridSize = gridSize; this.difficulty = difficulty; this.sound.tap(); this.start(this.pickRandom(this.current?.id)); }
  moveTo(cell) { const expectedWaypoint = this.engine.nextWaypoint; if (!this.engine.tryMove(cell)) return false; if (this.engine.numberAt(cell) === expectedWaypoint) this.sound.coin(); return true; }
  handleStart(event) {
    const point = pointFrom(event); if (!point) return; const controls = this.renderer.controls;
    if (this.renderer.hit(controls.sound, point)) { this.progress.setSoundEnabled(!this.progress.soundEnabled()); this.sound.setEnabled(this.progress.soundEnabled()); if (this.progress.soundEnabled()) this.sound.tap(); return this.render(); }
    if (this.clockSetupVisible) { const tier = controls.clockTiers?.find((item) => this.renderer.hit(item, point)); if (tier) return this.startClock(tier.id); if (this.renderer.hit(controls.clockCancel, point)) { this.clockSetupVisible = false; return this.render(); } return; }
    if (this.mode === "clock-ended") { if (this.renderer.hit(controls.clockRestart, point)) return this.startClock(this.clockResult.tier.id); if (this.renderer.hit(controls.clockLeaderboard, point)) { const opened = this.leaderboard.openFriendBoard({ clock: true }); try { wx?.showToast?.({ title: opened ? "时间挑战好友榜已请求加载" : "好友排名待微信授权", icon: "none" }); } catch (_) {} } return; }
    if (this.engine.getSnapshot().status === "completed") { if (this.renderer.hit(controls.close, point)) { this.completionDismissed = true; return this.render(); } if (this.renderer.hit(controls.next, point)) return this.selectStandard(); if (this.renderer.hit(controls.leaderboard, point)) { const opened = this.leaderboard.openFriendBoard(); try { wx?.showToast?.({ title: opened ? "好友榜已请求加载" : "好友排名待微信授权", icon: "none" }); } catch (_) {} return; } if (this.renderer.hit(controls.clock, point)) { this.completionDismissed = true; this.clockSetupVisible = true; this.sound.tap(); return this.render(); } return; }
    if (this.renderer.hit(controls.undo, point)) { this.engine.undo(); return this.sound.undo(); }
    if (this.renderer.hit(controls.reset, point)) { this.engine.reset(); return this.sound.reset(); }
    if (this.renderer.hit(controls.clock, point)) { this.clockSetupVisible = true; this.sound.tap(); return this.render(); }
    const difficulty = controls.difficulties?.find((item) => this.renderer.hit(item, point)); if (difficulty) return this.selectStandard(this.gridSize, difficulty.id);
    const size = controls.sizes?.find((item) => this.renderer.hit(item, point)); if (size) return this.selectStandard(size.id, this.difficulty);
    const cell = this.renderer.toCell(point); if (cell && this.moveTo(cell)) this.dragCell = `${cell.row}:${cell.col}`;
  }
  handleMove(event) { const point = pointFrom(event); if (!point || this.engine.getSnapshot().status === "completed" || this.clockSetupVisible || this.mode === "clock-ended") return; const cell = this.renderer.toCell(point); if (!cell) return; const key = `${cell.row}:${cell.col}`; if (key === this.dragCell) return; if (this.moveTo(cell)) this.dragCell = key; }
  handleEnd() { this.dragCell = null; }
  resize() { this.renderer.resize(); this.render(); }
  destroy() { this.stopClock(); this.unsubscribe?.(); this.sound.destroy?.(); }
}

module.exports = { CLOCK_BONUS_MS, CLOCK_DURATION_MS, CLOCK_TIERS, ForestTrailMiniGame, formatTime };
