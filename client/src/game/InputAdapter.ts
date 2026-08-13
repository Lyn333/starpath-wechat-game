/** 星图档案馆设计：浏览器输入只翻译坐标；路线合法性永远由 PathEngine 判定。 */
import type { Cell } from "./types";

export interface BoardHitTester {
  getCellAt(clientX: number, clientY: number): Cell | null;
  moveTo(cell: Cell): void;
}

export class InputAdapter {
  private dragging = false;
  private lastKey = "";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hitTester: BoardHitTester,
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", this.onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", this.onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", this.onPointerUp, { passive: false });
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.dragging = true;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.tryMove(event.clientX, event.clientY);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    event.preventDefault();
    this.tryMove(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    this.lastKey = "";
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private tryMove(clientX: number, clientY: number): void {
    const cell = this.hitTester.getCellAt(clientX, clientY);
    if (!cell) return;
    const key = `${cell.row}:${cell.col}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.hitTester.moveTo(cell);
  }
}
