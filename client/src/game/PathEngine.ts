/** 林下探险手册设计：纯 TypeScript 路径规则；它是微信 Canvas 版本可直接复用的核心。 */
import { forestTrailPuzzle } from "./puzzle";
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
  private message = "从林缘路标开始，把脚印留满整片林地。";
  private hintUntil = 0;

  constructor(puzzle: PuzzleDefinition = forestTrailPuzzle) {
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
        this.setMessage(`请从 ${start.number} 号林缘路标开始。`);
        return false;
      }
      this.path = [{ ...cell }];
      this.status = "active";
      this.nextWaypoint = 2;
      this.startedAt = performance.now();
      this.message = "第一枚脚印已落下。沿林径寻找下一枚路标。";
      this.emit();
      return true;
    }

    const tail = this.path[this.path.length - 1];
    const previous = this.path[this.path.length - 2];
    if (previous && sameCell(previous, cell)) {
      this.path.pop();
      this.message = "已踩回上一处脚印。";
      this.emit();
      return true;
    }

    const direction = directionBetween(tail, cell);
    if (!direction) return false;
    if (this.isBlocked(tail, cell, direction)) {
      this.setMessage("倒木与灌木挡住了这条小径。");
      return false;
    }
    if (this.path.some((visited) => sameCell(visited, cell))) {
      this.setMessage("林径不能重踏已经走过的地面。");
      return false;
    }

    const waypoint = this.puzzle.waypoints.find((item) => sameCell(item.cell, cell));
    if (waypoint && waypoint.number !== this.nextWaypoint) {
      this.setMessage(`应先经过 ${this.nextWaypoint} 号路标。`);
      return false;
    }

    this.path.push({ ...cell });
    if (waypoint) {
      this.nextWaypoint += 1;
      this.message = waypoint.number === this.puzzle.waypoints.length ? "最后一枚路标已抵达，正在确认整条林径。" : `${waypoint.number} 号路标已找到。`;
    } else {
      this.message = "脚步平稳，继续向前。";
    }

    if (this.path.length === this.puzzle.size * this.puzzle.size && this.nextWaypoint > this.puzzle.waypoints.length) {
      this.status = "completed";
      this.completedAt = performance.now();
      this.message = "林径走通。整片林地已留下完整脚印。";
    }
    this.emit();
    return true;
  }

  undo(): void {
    if (this.status === "completed") {
      this.setMessage("这条林径已经走通；请重置后重新入林。");
      return;
    }
    if (this.path.length === 0) return;
    this.path.pop();
    this.nextWaypoint = this.countPassedWaypoints() + 1;
    if (this.path.length === 0) {
      this.status = "idle";
      this.startedAt = null;
      this.message = "脚印已抹平。请重新从林缘路标出发。";
    } else {
      this.message = "已撤回最后一步脚印。";
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
    this.message = "林地已复位。请从林缘路标开始。";
    this.emit();
  }

  showHint(): void {
    if (this.status === "completed") return;
    this.hintUntil = performance.now() + 1400;
    this.message = "阳光穿过树叶，照亮了接下来的四步。";
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
