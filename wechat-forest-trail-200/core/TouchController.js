/** 微信触摸适配：仅将触点翻译为逻辑格坐标，所有合法性校验保留在 TrailEngine。 */

class TouchController {
  constructor(engine, renderer) {
    this.engine = engine;
    this.renderer = renderer;
    this.drawing = false;
    this.hintTimer = null;
  }

  handleStart(event) {
    const point = this.getPoint(event);
    if (!point) return;
    const control = this.renderer.hitControl(point);
    if (control) {
      if (control === "undo") this.engine.undo();
      if (control === "reset") this.engine.reset();
      if (control === "hint") this.showHint();
      this.drawing = false;
      return;
    }
    const cell = this.renderer.toCell(point);
    this.drawing = Boolean(cell && this.engine.tryMove(cell));
  }

  handleMove(event) {
    if (!this.drawing) return;
    const point = this.getPoint(event);
    const cell = point && this.renderer.toCell(point);
    if (cell) this.engine.tryMove(cell);
  }

  handleEnd() {
    this.drawing = false;
  }

  showHint() {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.engine.showHint(4);
    this.hintTimer = setTimeout(() => this.engine.clearHint(), 1400);
  }

  getPoint(event) {
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return null;
    return { x: touch.clientX ?? touch.x ?? touch.pageX, y: touch.clientY ?? touch.y ?? touch.pageY };
  }

  destroy() {
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }
}

module.exports = { TouchController };
