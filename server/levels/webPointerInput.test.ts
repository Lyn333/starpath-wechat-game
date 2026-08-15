import { describe, expect, it } from "vitest";
import { InputAdapter } from "../../client/src/game/InputAdapter";
import { FOREST_LEVELS } from "../../client/src/game/levelBundle";
import { PathEngine } from "../../client/src/game/PathEngine";

type Listener = (event: PointerEvent) => void;

function createFakeCanvas() {
  const listeners = new Map<string, Listener>();
  const canvas = {
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    setPointerCapture: () => undefined,
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
  } as unknown as HTMLCanvasElement;
  return { canvas, listeners };
}

function pointerAt(cell: { row: number; col: number }): PointerEvent {
  return { pointerId: 1, clientX: cell.col, clientY: cell.row, preventDefault: () => undefined } as PointerEvent;
}

function replayFirstFiveCells(level: (typeof FOREST_LEVELS)[number]) {
  const engine = new PathEngine(level);
  const { canvas, listeners } = createFakeCanvas();
  const adapter = new InputAdapter(canvas, {
    getCellAt: (x, y) => ({ row: y, col: x }),
    moveTo: (cell) => engine.moveTo(cell),
  });
  const path = level.solution.slice(0, 5);
  listeners.get("pointerdown")?.(pointerAt(path[0]));
  path.slice(1).forEach((cell) => listeners.get("pointermove")?.(pointerAt(cell)));
  listeners.get("pointerup")?.(pointerAt(path.at(-1)!));
  adapter.dispose();
  return engine.getSnapshot();
}

describe("网页端Canvas连线输入", () => {
  it("可通过指针路径推进6×6关卡的合法林径", () => {
    const level = FOREST_LEVELS.find((item) => item.gridSize === "6x6" && item.difficulty === "easy")!;
    const snapshot = replayFirstFiveCells(level);
    expect(snapshot.path).toEqual(level.solution.slice(0, 5));
    expect(snapshot.moves).toBe(4);
  });

  it("可通过指针路径推进8×8关卡的合法林径", () => {
    const level = FOREST_LEVELS.find((item) => item.gridSize === "8x8" && item.difficulty === "easy")!;
    const snapshot = replayFirstFiveCells(level);
    expect(snapshot.path).toEqual(level.solution.slice(0, 5));
    expect(snapshot.moves).toBe(4);
  });
});
