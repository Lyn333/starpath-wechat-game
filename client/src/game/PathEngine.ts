/** 星图档案馆设计：纯 TypeScript 路线规则；它是微信 Canvas 版本可直接复用的核心。 */
import { starChartPuzzle } from "./puzzle";
import {
  cellKey,
  directionBetween,
  oppositeDirection,
  sameCell,
  type Cell,
  type GameSnapshot,
  type PuzzleDefinition,
} from "./types";

type Listener = (snapshot: GameSnapshot) => void;

export class PathEngine {
  readonly puzzle: PuzzleDefinition;
  private readonly listeners = new Set<Listener>();
  private path: Cell[] = [];
  private status: GameSnapshot["status"] = "idle";
  private nextWaypoint = 1;
  private startedAt: number | null = null;
  private completedAt: number | null = null;
  private message = "从启明星开始，绘制一条完整航线。";
  private hintUntil = 0;

  constructor(puzzle: PuzzleDefinition = starChartPuzzle) {
    this.puzzle = puzzle;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(now = performance.now()): GameSnapshot {
    const end = this.completedAt ?? now;
    const elapsedMs = this.startedAt === null ? 0 : Math.max(0, end - this.startedAt);
    const hintStart = Math.max(this.path.length, 1);
    const hintCells = now < this.hintUntil ? this.puzzle.solution.slice(hintStart, hintStart + 4) : [];

    return {
      path: this.path.map((cell) => ({ ...cell })),
      status: this.status,
      nextWaypoint: this.nextWaypoint,
      elapsedMs,
      moves: Math.max(0, this.path.length - 1),
      message: this.message,
      hintCells,
    };
  }

  moveTo(cell: Cell): boolean {
    if (!this.isInBounds(cell) || this.status === "completed") return false;

    if (this.path.length === 0) {
      const start = this.puzzle.waypoints[0];
      if (!sameCell(cell, start.cell)) {
        this.setMessage(`请从 ${start.number} 号启明星开始。`);
        return false;
      }
      this.path = [{ ...cell }];
      this.status = "active";
      this.nextWaypoint = 2;
      this.startedAt = performance.now();
      this.message = "起航已确认。沿网格寻找下一座信标。";
      this.emit();
      return true;
    }

    const tail = this.path[this.path.length - 1];
    const previous = this.path[this.path.length - 2];
    if (previous && sameCell(previous, cell)) {
      this.path.pop();
      this.message = "已退回上一段航迹。";
      this.emit();
      return true;
    }

    const direction = directionBetween(tail, cell);
    if (!direction) return false;
    if (this.isBlocked(tail, cell, direction)) {
      this.setMessage("测绘墙阻断了这条航线。");
      return false;
    }
    if (this.path.some((visited) => sameCell(visited, cell))) {
      this.setMessage("航线不能重访已测绘的格点。");
      return false;
    }

    const waypoint = this.puzzle.waypoints.find((item) => sameCell(item.cell, cell));
    if (waypoint && waypoint.number !== this.nextWaypoint) {
      this.setMessage(`应先经过 ${this.nextWaypoint} 号信标。`);
      return false;
    }

    this.path.push({ ...cell });
    if (waypoint) {
      this.nextWaypoint += 1;
      this.message = waypoint.number === this.puzzle.waypoints.length ? "最终信标已抵达，正在校验星图。" : `${waypoint.number} 号信标已校准。`;
    } else {
      this.message = "航迹稳定。";
    }

    if (this.path.length === this.puzzle.size * this.puzzle.size && this.nextWaypoint > this.puzzle.waypoints.length) {
      this.status = "completed";
      this.completedAt = performance.now();
      this.message = "航图归档完成。整条星轨已校准。";
    }
    this.emit();
    return true;
  }

  undo(): void {
    if (this.status === "completed") {
      this.setMessage("航图已归档；请重置以绘制新的航线。\n");
      return;
    }
    if (this.path.length === 0) return;
    this.path.pop();
    this.nextWaypoint = this.countPassedWaypoints() + 1;
    if (this.path.length === 0) {
      this.status = "idle";
      this.startedAt = null;
      this.message = "航线已撤回。请重新从启明星出发。";
    } else {
      this.message = "已撤回最后一格航迹。";
    }
    this.emit();
  }

  reset(): void {
    this.path = [];
    this.status = "idle";
    this.nextWaypoint = 1;
    this.startedAt = null;
    this.completedAt = null;
    this.hintUntil = 0;
    this.message = "航图已复位。请从启明星开始。";
    this.emit();
  }

  showHint(): void {
    if (this.status === "completed") return;
    this.hintUntil = performance.now() + 1400;
    this.message = "已投射接下来四个可测绘格点。";
    this.emit();
    window.setTimeout(() => this.emit(), 1420);
  }

  private countPassedWaypoints(): number {
    return this.puzzle.waypoints.filter((waypoint) => this.path.some((cell) => sameCell(cell, waypoint.cell))).length;
  }

  private isInBounds(cell: Cell): boolean {
    return cell.row >= 0 && cell.row < this.puzzle.size && cell.col >= 0 && cell.col < this.puzzle.size;
  }

  private isBlocked(from: Cell, to: Cell, direction: NonNullable<ReturnType<typeof directionBetween>>): boolean {
    return this.puzzle.walls.some((wall) => {
      if (sameCell(wall.cell, from) && wall.direction === direction) return true;
      return sameCell(wall.cell, to) && wall.direction === oppositeDirection(direction);
    });
  }

  private setMessage(message: string): void {
    this.message = message;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const toCellKey = cellKey;
