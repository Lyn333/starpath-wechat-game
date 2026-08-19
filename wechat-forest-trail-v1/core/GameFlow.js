const { TrailEngine } = require("./TrailEngine");
const { SingleBoardRenderer } = require("./SingleBoardRenderer");
const { ProgressStore } = require("./ProgressStore");
const { SoundFx } = require("./SoundFx");
const { createDailyChallenge, createContinuation } = require("./DailyChallenge");

const SIZES = ["6x6", "8x8", "10x10", "12x12"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const LABELS = { easy: "简单", medium: "中等", hard: "困难" };

function pointFrom(event) { const touch = event.touches?.[0] || event.changedTouches?.[0]; return touch ? { x: touch.clientX ?? touch.x ?? touch.pageX, y: touch.clientY ?? touch.y ?? touch.pageY } : null; }
function shuffle(items, random = Math.random) { return [...items].sort(() => random() - .5); }
function formatTime(ms) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

class ForestTrailMiniGame {
  constructor(canvas, levels) {
    this.canvas = canvas; this.levels = levels; this.progress = new ProgressStore(); this.sound = new SoundFx(this.progress.soundEnabled());
    this.renderer = new SingleBoardRenderer(canvas); this.gridSize = "6x6"; this.difficulty = "easy"; this.mode = "standard"; this.dragCell = null; this.startedAt = Date.now(); this.current = this.pickRandom(); this.start(this.current);
  }
  pickRandom(excludeId) {
    const choices = this.levels.filter((level) => level.gridSize === this.gridSize && level.difficulty === this.difficulty && level.id !== excludeId && !this.progress.isCompleted(level.id));
    if (choices.length) return shuffle(choices)[0];
    return createContinuation(this.gridSize, this.difficulty, this.progress.nextContinuation(this.gridSize, this.difficulty));
  }
  start(level) {
    this.current = level; this.wasCompleted = false; this.dragCell = null; this.startedAt = Date.now(); this.renderer.setLevel(level); this.engine = new TrailEngine(level);
    this.unsubscribe?.(); this.unsubscribe = this.engine.subscribe((snapshot) => { if (snapshot.status === "completed" && !this.wasCompleted) { this.wasCompleted = true; this.progress.markComplete(level, { moves: snapshot.moves, elapsedMs: Date.now() - this.startedAt }); this.sound.complete(); } this.render(snapshot); });
  }
  view(snapshot = this.engine.getSnapshot()) { return { daily: this.mode === "daily", dailyComplete: this.mode === "daily" && this.progress.isDailyComplete(this.current), gridSize: this.gridSize, difficulty: this.difficulty, difficultyLabel: LABELS[this.difficulty], sound: this.progress.soundEnabled(), points: snapshot.status === "completed" ? Math.max(10, Math.round(1200 / Math.max(1, snapshot.moves))) : 0, time: formatTime(Date.now() - this.startedAt) }; }
  render(snapshot = this.engine.getSnapshot()) { this.renderer.render(snapshot, this.view(snapshot)); }
  selectStandard(gridSize = this.gridSize, difficulty = this.difficulty) { this.mode = "standard"; this.gridSize = gridSize; this.difficulty = difficulty; this.sound.tap(); this.start(this.pickRandom(this.current?.id)); }
  selectDaily() { const level = createDailyChallenge(); this.mode = "daily"; this.gridSize = level.gridSize; this.difficulty = level.difficulty; this.sound.tap(); this.start(level); }
  moveTo(cell) { const expectedWaypoint = this.engine.nextWaypoint; if (!this.engine.tryMove(cell)) return false; if (this.engine.numberAt(cell) === expectedWaypoint) this.sound.coin(); return true; }
  handleStart(event) {
    const point = pointFrom(event); if (!point) return; const controls = this.renderer.controls;
    if (this.renderer.hit(controls.sound, point)) { this.progress.setSoundEnabled(!this.progress.soundEnabled()); this.sound.setEnabled(this.progress.soundEnabled()); if (this.progress.soundEnabled()) this.sound.tap(); return this.render(); }
    if (this.engine.getSnapshot().status === "completed") { if (this.renderer.hit(controls.next, point)) return this.mode === "daily" ? this.selectStandard(this.gridSize, this.difficulty) : this.selectStandard(); return; }
    if (this.renderer.hit(controls.undo, point)) { this.engine.undo(); return this.sound.undo(); }
    if (this.renderer.hit(controls.reset, point)) { this.engine.reset(); return this.sound.reset(); }
    if (this.renderer.hit(controls.daily, point)) return this.selectDaily();
    const difficulty = controls.difficulties?.find((item) => this.renderer.hit(item, point)); if (difficulty) return this.selectStandard(this.gridSize, difficulty.id);
    const size = controls.sizes?.find((item) => this.renderer.hit(item, point)); if (size) return this.selectStandard(size.id, this.difficulty);
    const cell = this.renderer.toCell(point); if (cell && this.moveTo(cell)) this.dragCell = `${cell.row}:${cell.col}`;
  }
  handleMove(event) { const point = pointFrom(event); if (!point || this.engine.getSnapshot().status === "completed") return; const cell = this.renderer.toCell(point); if (!cell) return; const key = `${cell.row}:${cell.col}`; if (key === this.dragCell) return; if (this.moveTo(cell)) this.dragCell = key; }
  handleEnd() { this.dragCell = null; }
  resize() { this.renderer.resize(); this.render(); }
  destroy() { this.unsubscribe?.(); this.sound.destroy?.(); }
}

module.exports = { ForestTrailMiniGame, formatTime };
