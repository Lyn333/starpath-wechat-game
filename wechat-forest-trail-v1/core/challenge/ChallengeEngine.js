/**
 * 关卡挑战引擎：按“目标图案顺序”依次点选棋盘上的图案（任意两格之间连线）。
 *
 * 与 TrailEngine 的相邻拖动不同，这里不要求相邻、不要求覆盖全盘、不自回避——
 * 只要按顺序点中图案即可，连接线在渲染层直接绘制成折线。
 * 连线使用 supercover 格子遍历：若两点之间穿过障碍格则拒绝，空格/障碍格本身的点选仍忽略。
 * 对外暴露与 TrailEngine 兼容的接口（subscribe / getSnapshot / tryMove / numberAt /
 * undo / reset / nextWaypoint / errors），以便复用 GameFlow 与渲染器。
 */

function cellKey(cell) { return `${cell.row}-${cell.col}`; }
function sameCell(a, b) { return a.row === b.row && a.col === b.col; }
function copyCell(cell) { return { row: cell.row, col: cell.col }; }

// Supercover：穿过格角时同时计入两侧格子，避免对角“擦过”障碍。
function cellsOnLine(row0, col0, row1, col1) {
  const cells = [{ row: row0, col: col0 }];
  const dr = row1 - row0, dc = col1 - col0;
  const nr = Math.abs(dr), nc = Math.abs(dc);
  const sr = dr > 0 ? 1 : dr < 0 ? -1 : 0;
  const sc = dc > 0 ? 1 : dc < 0 ? -1 : 0;
  let row = row0, col = col0, ir = 0, ic = 0;
  while (ir < nr || ic < nc) {
    const decision = (1 + 2 * ic) * nr - (1 + 2 * ir) * nc;
    if (decision === 0) {
      cells.push({ row, col: col + sc });
      cells.push({ row: row + sr, col });
      row += sr;
      col += sc;
      ir += 1;
      ic += 1;
      cells.push({ row, col });
    } else if (decision < 0) {
      col += sc;
      ic += 1;
      cells.push({ row, col });
    } else {
      row += sr;
      ir += 1;
      cells.push({ row, col });
    }
  }
  return cells;
}

function blockedKeySet(blockedCells) {
  if (blockedCells instanceof Set) return blockedCells;
  return new Set((blockedCells || []).map(cellKey));
}

function lineCrossesBlocked(from, to, blockedCells) {
  const blocked = blockedKeySet(blockedCells);
  if (!blocked.size || !from || !to) return false;
  const cells = cellsOnLine(from.row, from.col, to.row, to.col);
  for (let index = 1; index < cells.length - 1; index += 1) {
    if (blocked.has(cellKey(cells[index]))) return true;
  }
  return false;
}

class ChallengeEngine {
  constructor(level) {
    this.level = level;
    this.rows = level.rows;
    this.cols = level.cols;
    this.numberByCell = new Map(level.waypoints.map((waypoint) => [cellKey(waypoint.cell), waypoint.number]));
    this.orderedCells = [...level.waypoints].sort((a, b) => a.number - b.number).map((waypoint) => copyCell(waypoint.cell));
    this.blocked = blockedKeySet(level.blockedCells);
    this.total = level.waypoints.length;
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
      flashCombo: this.flashCombo,
      maxFlashCombo: this.maxFlashCombo,
      lastRejectedCell: this.lastRejectedCell ? copyCell(this.lastRejectedCell) : null,
      totalWaypoints: this.total,
    };
  }

  numberAt(cell) {
    return this.numberByCell.get(cellKey(cell)) || null;
  }

  isBlocked(cell) {
    return this.blocked.has(cellKey(cell));
  }

  isInBounds(cell) {
    return Number.isInteger(cell.row) && Number.isInteger(cell.col) && cell.row >= 0 && cell.row < this.rows && cell.col >= 0 && cell.col < this.cols;
  }

  reject(cell, message) {
    this.errors += 1;
    this.combo = 0;
    this.flashCombo = 0;
    this.lastRejectedCell = copyCell(cell);
    this.setMessage(message);
    return false;
  }

  // 点选一个格子。命中当前目标图案则前进；命中其它图案（顺序错误或已连接）记为错误；点空格/障碍格忽略。
  // 当前目标若与上一图案的直线穿过障碍格，记为错误且不前进。
  tryMove(cell) {
    if (this.status === "completed" || !this.isInBounds(cell)) return false;
    const waypoint = this.numberAt(cell);
    if (!waypoint) return false; // 空格或障碍格：忽略，不计错误。
    if (waypoint !== this.nextWaypoint) {
      return this.reject(cell, waypoint < this.nextWaypoint ? "这个图案已经连过了。" : `请先点选第 ${this.nextWaypoint} 个图案。`);
    }
    if (this.path.length && lineCrossesBlocked(this.path[this.path.length - 1], cell, this.blocked)) {
      return this.reject(cell, "连线穿过了障碍。");
    }
    this.path.push(copyCell(cell));
    this.nextWaypoint += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.level.memoryMode === "flash") {
      this.flashCombo += 1;
      this.maxFlashCombo = Math.max(this.maxFlashCombo, this.flashCombo);
    }
    this.lastRejectedCell = null;
    this.status = "active";
    if (this.nextWaypoint > this.total) {
      this.status = "completed";
      this.setMessage("图案全部按顺序连通，关卡完成！");
    } else {
      this.setMessage(`已连接第 ${waypoint} 个图案，继续寻找下一个。`);
    }
    return true;
  }

  undo() {
    if (this.status === "completed") { this.setMessage("本关已经完成；请重新开始后再试。"); return; }
    if (!this.path.length) return;
    this.path.pop();
    this.nextWaypoint = this.path.length + 1;
    this.combo = 0;
    this.flashCombo = 0;
    this.status = this.path.length ? "active" : "idle";
    this.setMessage(this.path.length ? "已撤回上一次连接。" : "已清空，从第一个图案重新开始。");
  }

  reset() {
    this.path = [];
    this.status = "idle";
    this.nextWaypoint = 1;
    this.errors = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.flashCombo = 0;
    this.maxFlashCombo = 0;
    this.lastRejectedCell = null;
    this.message = "按顺序点选图案，把它们依次连起来。";
    this.emit();
  }

  // 与 TrailEngine 接口对齐：关卡挑战不做进度存档 / 提示。
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

module.exports = { ChallengeEngine, cellKey, sameCell, cellsOnLine, lineCrossesBlocked };
