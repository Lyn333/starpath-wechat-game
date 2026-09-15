/**
 * 水果乐园引擎：四方向相邻拖动、不重复走格、按 1～10 检查点顺序覆盖全盘。
 *
 * 与 TrailEngine 的差异：最大编号水果不必是路径最后一格；到达 10 后若仍有空格必须继续。
 * 与 ChallengeEngine 的差异：不能点选跳跃，必须相邻连续。
 */

const { cellKey, copyCell, isAdjacent, sameCell } = require("./FruitParadise");

function fruitAtMap(level) {
  return new Map(level.waypoints.map((waypoint) => [cellKey(waypoint.cell), waypoint]));
}

class FruitParadiseEngine {
  constructor(level) {
    this.level = level;
    this.rows = level.rows;
    this.cols = level.cols;
    this.fruitByCell = fruitAtMap(level);
    this.totalFruits = level.waypoints.length;
    this.totalCells = level.rows * level.cols;
    this.errorMode = level.errorMode || "practice-step";
    this.listeners = new Set();
    this.reset();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return {
      status: this.status,
      path: this.path.map(copyCell),
      nextWaypoint: this.nextWaypoint,
      message: this.message,
      hintCells: [],
      moves: Math.max(0, this.path.length - 1),
      errors: this.errors,
      combo: this.combo,
      maxCombo: this.maxCombo,
      lastRejectedCell: this.lastRejectedCell ? copyCell(this.lastRejectedCell) : null,
      totalWaypoints: this.totalFruits,
      covered: this.path.length,
      totalCells: this.totalCells,
      fruit10Reached: this.fruit10Reached,
      failed: this.status === "failed",
      failReason: this.failReason,
      redBreak: this.redBreak ? copyCell(this.redBreak) : null,
    };
  }

  numberAt(cell) {
    return this.fruitByCell.get(cellKey(cell))?.number || null;
  }

  fruitAt(cell) {
    return this.fruitByCell.get(cellKey(cell)) || null;
  }

  isInBounds(cell) {
    return Number.isInteger(cell?.row) && Number.isInteger(cell?.col) && cell.row >= 0 && cell.row < this.rows && cell.col >= 0 && cell.col < this.cols;
  }

  visited(cell) {
    return this.path.some((item) => sameCell(item, cell));
  }

  hasLegalMove() {
    if (!this.path.length) return true;
    const tail = this.path[this.path.length - 1];
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
      const next = { row: tail.row + dr, col: tail.col + dc };
      return this.isInBounds(next) && !this.visited(next);
    });
  }

  lastFruitPathIndex() {
    let found = -1;
    this.path.forEach((cell, index) => {
      if (this.numberAt(cell)) found = index;
    });
    return found;
  }

  setFailed(reason, cell = null) {
    this.status = "failed";
    this.failReason = reason;
    this.lastRejectedCell = cell ? copyCell(cell) : this.lastRejectedCell;
    this.setMessage(reason);
    return false;
  }

  applyWrongFruit(cell) {
    this.errors += 1;
    this.combo = 0;
    this.lastRejectedCell = copyCell(cell);
    if (this.errorMode === "challenge-fail") return this.setFailed("碰到错误水果。", cell);
    if (this.errorMode === "practice-fruit") this.rollbackToLastFruit();
    else this.rollbackOne();
    this.setMessage("路线中断");
    return false;
  }

  applyRevisit(cell) {
    this.errors += 1;
    this.combo = 0;
    this.lastRejectedCell = copyCell(cell);
    this.redBreak = copyCell(cell);
    if (this.errorMode === "challenge-fail") return this.setFailed("不能重复经过同一格。", cell);
    this.rollbackOne();
    this.setMessage("不能重复经过同一格。");
    return false;
  }

  rollbackOne() {
    if (!this.path.length) return;
    this.path.pop();
    this.syncAfterPathChange();
  }

  rollbackToLastFruit() {
    const index = this.lastFruitPathIndex();
    this.path = index >= 0 ? this.path.slice(0, index + 1) : [];
    this.syncAfterPathChange();
  }

  syncAfterPathChange() {
    this.nextWaypoint = this.countPassedFruits() + 1;
    this.fruit10Reached = this.countPassedFruits() >= this.totalFruits;
    this.status = this.path.length ? "active" : "idle";
    if (this.path.length === 0) this.fruit10Reached = false;
  }

  countPassedFruits() {
    return this.level.waypoints.filter((waypoint) => this.path.some((cell) => sameCell(cell, waypoint.cell))).length;
  }

  tryMove(cell) {
    if (this.status === "completed" || this.status === "failed" || !this.isInBounds(cell)) return false;
    const candidate = copyCell(cell);

    if (this.path.length === 0) {
      if (this.numberAt(candidate) !== 1) {
        this.lastRejectedCell = copyCell(candidate);
        this.setMessage("请从水果 1 的位置开始拖动。");
        return false;
      }
      this.path = [candidate];
      this.status = "active";
      this.nextWaypoint = 2;
      this.lastRejectedCell = null;
      this.redBreak = null;
      this.setMessage("开始盲连。覆盖整张棋盘。");
      return true;
    }

    const tail = this.path[this.path.length - 1];
    if (!isAdjacent(tail, candidate)) return false;
    if (this.visited(candidate)) return this.applyRevisit(candidate);

    const fruit = this.fruitAt(candidate);
    if (fruit && fruit.number !== this.nextWaypoint) return this.applyWrongFruit(candidate);

    this.path.push(candidate);
    this.lastRejectedCell = null;
    this.redBreak = null;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    if (fruit) {
      this.nextWaypoint += 1;
      if (fruit.number === this.totalFruits) this.fruit10Reached = true;
    }

    if (this.path.length === this.totalCells && this.nextWaypoint > this.totalFruits) {
      this.status = "completed";
      this.setMessage("水果顺序正确，棋盘全部覆盖。");
      return true;
    }

    if (!this.hasLegalMove()) {
      if (this.fruit10Reached && this.path.length !== this.totalCells) {
        return this.setFailed("终点已到达，但棋盘尚未完成。", candidate);
      }
      return this.setFailed("走入不可用路径。", candidate);
    }

    if (this.fruit10Reached && this.path.length !== this.totalCells) this.setMessage("终点已到达，但棋盘尚未完成。");
    else if (fruit) this.setMessage("继续覆盖剩余格子。");
    else this.emit();
    return true;
  }

  undo() {
    if (this.status === "completed" || this.status === "failed") {
      this.setMessage(this.status === "completed" ? "本关已经完成。" : "本局已经结束。");
      return false;
    }
    if (!this.path.length) return false;
    this.rollbackOne();
    this.combo = 0;
    this.setMessage(this.path.length ? "已撤销最近一步。" : "已回到起点。");
    return true;
  }

  fail(reason) {
    if (this.status === "completed" || this.status === "failed") return false;
    return this.setFailed(reason || "本局失败。");
  }

  reset() {
    this.path = [];
    this.status = "idle";
    this.nextWaypoint = 1;
    this.errors = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastRejectedCell = null;
    this.redBreak = null;
    this.fruit10Reached = false;
    this.failReason = null;
    this.message = "记住水果后，从 1 盲连到 10，并走完整张棋盘。";
    this.emit();
  }

  serializeState() { return { version: 1, levelId: this.level.id, path: this.path.map(copyCell) }; }
  restoreState() { return false; }
  showHint() {}
  showHintCells() {}
  clearHint() {}

  setMessage(message, emit = true) {
    this.message = message;
    if (emit) this.emit();
  }

  emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

module.exports = { FruitParadiseEngine };
