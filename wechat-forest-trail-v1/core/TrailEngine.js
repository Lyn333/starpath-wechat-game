/**
 * 森林寻径核心规则：不依赖 wx、Canvas 或 React，可直接用于微信小游戏和浏览器调试。
 * 墙体格式：H_row_col 表示 (row,col) 与 (row+1,col) 的边界；V_row_col 表示 (row,col) 与 (row,col+1) 的边界。
 */

function cellKey(cell) {
  return `${cell.row}-${cell.col}`;
}

function sameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function copyCell(cell) {
  return { row: cell.row, col: cell.col };
}

class TrailEngine {
  constructor(level) {
    this.level = this.normalizeLevel(level);
    this.listeners = new Set();
    this.reset();
  }

  normalizeLevel(level) {
    if (!level || !Number.isInteger(level.rows) || !Number.isInteger(level.cols)) {
      throw new Error("关卡必须包含 rows 和 cols。");
    }
    const numberByCell = new Map();
    const waypoints = [...level.waypoints].sort((a, b) => a.number - b.number).map((item) => ({
      number: item.number,
      cell: copyCell(item.cell),
    }));
    waypoints.forEach((waypoint, index) => {
      if (waypoint.number !== index + 1) throw new Error("路标编号必须从 1 连续递增。");
      numberByCell.set(cellKey(waypoint.cell), waypoint.number);
    });
    return {
      ...level,
      waypoints,
      numberByCell,
      walls: new Set(level.walls || []),
      solution: (level.solution || []).map(copyCell),
    };
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
      hintCells: this.hintCells.map(copyCell),
      moves: Math.max(0, this.path.length - 1),
    };
  }

  tryMove(cell) {
    if (!this.isInBounds(cell) || this.status === "completed") return false;
    const candidate = copyCell(cell);

    if (this.path.length === 0) {
      if (this.numberAt(candidate) !== 1) {
        this.setMessage("请从 1 号林缘路标出发。");
        return false;
      }
      this.path = [candidate];
      this.status = "active";
      this.nextWaypoint = 2;
      this.setMessage("第一枚脚印已落下。沿林径寻找下一枚路标。");
      return true;
    }

    const tail = this.path[this.path.length - 1];
    const previous = this.path[this.path.length - 2];
    if (previous && sameCell(previous, candidate)) {
      this.path.pop();
      this.nextWaypoint = this.countPassedWaypoints() + 1;
      this.setMessage(this.path.length ? "已踩回上一处脚印。" : "脚印已抹平。请重新从林缘路标出发。");
      if (this.path.length === 0) this.status = "idle";
      return true;
    }

    if (!isAdjacent(tail, candidate)) return false;
    if (this.isBlocked(tail, candidate)) {
      this.setMessage("倒木与灌木挡住了这条小径。");
      return false;
    }
    if (this.path.some((visited) => sameCell(visited, candidate))) {
      this.setMessage("林径不能重踏已经走过的地面。");
      return false;
    }

    const waypoint = this.numberAt(candidate);
    if (waypoint && waypoint !== this.nextWaypoint) {
      this.setMessage(`应先经过 ${this.nextWaypoint} 号路标。`);
      return false;
    }

    this.path.push(candidate);
    if (waypoint) {
      this.nextWaypoint += 1;
      this.setMessage(waypoint === this.level.waypoints.length ? "最后一枚路标已抵达，正在确认整条林径。" : `${waypoint} 号路标已找到。`);
    } else {
      this.setMessage("脚步平稳，继续向前。", false);
    }

    if (this.path.length === this.level.rows * this.level.cols && this.nextWaypoint > this.level.waypoints.length) {
      this.status = "completed";
      this.setMessage("林径走通。整片林地已留下完整脚印。");
    } else {
      this.emit();
    }
    return true;
  }

  undo() {
    if (this.status === "completed") {
      this.setMessage("这条林径已经走通；请重新入林后再试。", true);
      return;
    }
    if (!this.path.length) return;
    this.path.pop();
    this.nextWaypoint = this.countPassedWaypoints() + 1;
    this.status = this.path.length ? "active" : "idle";
    this.setMessage(this.path.length ? "已撤回最后一步脚印。" : "脚印已抹平。请重新从林缘路标出发。");
  }

  reset() {
    this.path = [];
    this.status = "idle";
    this.nextWaypoint = 1;
    this.hintCells = [];
    this.message = "从林缘路标开始，把脚印留满整片林地。";
    this.emit();
  }

  showHint(stepCount = 4) {
    if (this.status === "completed" || !this.level.solution.length) return;
    const from = this.path.length;
    this.hintCells = this.level.solution.slice(from, from + stepCount).map(copyCell);
    this.setMessage("阳光穿过树叶，照亮了接下来的林径。");
  }

  clearHint() {
    if (!this.hintCells.length) return;
    this.hintCells = [];
    this.emit();
  }

  numberAt(cell) {
    return this.level.numberByCell.get(cellKey(cell)) || null;
  }

  isInBounds(cell) {
    return Number.isInteger(cell.row) && Number.isInteger(cell.col) && cell.row >= 0 && cell.row < this.level.rows && cell.col >= 0 && cell.col < this.level.cols;
  }

  isBlocked(from, to) {
    if (from.row === to.row) {
      return this.level.walls.has(`V_${from.row}_${Math.min(from.col, to.col)}`);
    }
    return this.level.walls.has(`H_${Math.min(from.row, to.row)}_${from.col}`);
  }

  countPassedWaypoints() {
    return this.level.waypoints.filter((waypoint) => this.path.some((cell) => sameCell(cell, waypoint.cell))).length;
  }

  setMessage(message, emit = true) {
    this.message = message;
    if (emit) this.emit();
  }

  emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

module.exports = { TrailEngine, cellKey, sameCell, isAdjacent };
