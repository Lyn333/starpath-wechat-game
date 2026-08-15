// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDemoGrid, getDemoStepMs, startDemoPlayback } from "../../client/src/game/demoPlayback";
import { PathEngine } from "../../client/src/game/PathEngine";
import { createSeededPuzzle } from "../../client/src/game/seededPuzzle";

describe("demo playback", () => {
  afterEach(() => vi.useRealTimers());

  it("maps demo=12 to the 12×12 launch category and recognizes the fast verifier", () => {
    expect(getDemoGrid("?demo=12")).toBe("12x12");
    expect(getDemoStepMs("?demo=12&demoSpeed=fast")).toBe(2);
  });

  it("automatically advances a 12×12 puzzle after the demo starts", () => {
    vi.useFakeTimers();
    const puzzle = createSeededPuzzle({ gridSize: "12x12", difficulty: "easy", seed: "demo-12", ordinal: 1 });
    const engine = new PathEngine(puzzle);
    const stop = startDemoPlayback(engine, true, 2, 1);
    vi.advanceTimersByTime(20);
    expect(engine.getSnapshot().moves).toBeGreaterThan(0);
    stop();
  });
});
