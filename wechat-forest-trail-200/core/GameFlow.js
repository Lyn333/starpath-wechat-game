const { TrailEngine } = require("./TrailEngine");
const { TrailRenderer } = require("./TrailRenderer");
const { TouchController } = require("./TouchController");
const { LevelLibraryRenderer } = require("./LevelLibraryRenderer");
const { ProgressStore } = require("./ProgressStore");
const { LEVELS } = require("../data/levelBundle");

function getPoint(event) {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  return touch ? { x: touch.clientX ?? touch.x ?? touch.pageX, y: touch.clientY ?? touch.y ?? touch.pageY } : null;
}

class ForestPathGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.progress = new ProgressStore();
    this.library = new LevelLibraryRenderer(canvas, LEVELS, this.progress);
    this.mode = "library";
    this.engine = null;
    this.renderer = null;
    this.controller = null;
    this.currentLevel = null;
    this.wasCompleted = false;
    this.showLibrary();
  }

  showLibrary() {
    this.controller?.destroy();
    this.mode = "library"; this.engine = null; this.renderer = null; this.controller = null; this.currentLevel = null;
    this.library.render();
  }

  startLevel(level) {
    this.mode = "play"; this.currentLevel = level; this.wasCompleted = false; this.progress.setLastLevel(level.id);
    this.engine = new TrailEngine(level); this.renderer = new TrailRenderer(this.canvas, level); this.controller = new TouchController(this.engine, this.renderer);
    this.engine.subscribe((snapshot) => {
      this.renderer.render(snapshot); this.drawGameNav(snapshot);
      if (snapshot.status === "completed" && !this.wasCompleted) { this.wasCompleted = true; this.progress.complete(level.id, { moves: snapshot.moves, elapsedMs: 0 }); }
    });
  }

  drawGameNav(snapshot) {
    const ctx = this.renderer.ctx;
    this.backBounds = { x: 18, y: 13, width: 62, height: 29 };
    ctx.fillStyle = "rgba(53,39,25,.92)"; ctx.fillRect(this.backBounds.x, this.backBounds.y, this.backBounds.width, this.backBounds.height); ctx.strokeStyle = "rgba(226,175,82,.7)"; ctx.strokeRect(this.backBounds.x, this.backBounds.y, this.backBounds.width, this.backBounds.height); ctx.fillStyle = "#F4EFD9"; ctx.font = "10px sans-serif"; ctx.fillText("‹ 目录", 30, 32);
    this.nextBounds = null;
    if (snapshot.status === "completed") { this.nextBounds = { x: this.renderer.width / 2 - 72, y: this.renderer.height / 2 + 91, width: 144, height: 33 }; ctx.fillStyle = "#E2AF52"; ctx.fillRect(this.nextBounds.x, this.nextBounds.y, this.nextBounds.width, this.nextBounds.height); ctx.fillStyle = "#173725"; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText("下一条林径", this.renderer.width / 2, this.nextBounds.y + 21); ctx.textAlign = "left"; }
  }

  touchStart(event) {
    const point = getPoint(event); if (!point) return;
    if (this.mode === "library") {
      const action = this.library.hit(point); if (!action) return;
      if (action.type === "size") this.library.setSize(action.value);
      if (action.type === "difficulty") this.library.setDifficulty(action.value);
      if (action.type === "previous") this.library.previousPage();
      if (action.type === "next") this.library.nextPage();
      if (action.type === "level") this.startLevel(action.level);
      return;
    }
    if (this.contains(this.backBounds, point)) return this.showLibrary();
    if (this.contains(this.nextBounds, point)) return this.startNextLevel();
    this.controller.handleStart(event);
  }

  touchMove(event) { if (this.mode === "play") this.controller.handleMove(event); }
  touchEnd() { if (this.mode === "play") this.controller.handleEnd(); }
  resize() { if (this.mode === "library") { this.library.resize(); this.library.render(); } else { this.renderer.resize(); this.renderer.render(this.engine.getSnapshot()); this.drawGameNav(this.engine.getSnapshot()); } }
  contains(box, point) { return Boolean(box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height); }

  startNextLevel() {
    const group = LEVELS.filter((level) => level.gridSize === this.currentLevel.gridSize && level.difficulty === this.currentLevel.difficulty);
    const index = group.findIndex((level) => level.id === this.currentLevel.id);
    const next = group[index + 1];
    if (next && this.progress.isUnlocked(group, index + 1)) this.startLevel(next); else this.showLibrary();
  }
}

module.exports = { ForestPathGame };
