import { describe, expect, it } from "vitest";
import { PathEngine } from "../../client/src/game/PathEngine";

describe("PathEngine hint visibility", () => {
  it("keeps four upcoming cells visible for at least two seconds", () => {
    const engine = new PathEngine();
    const startedAt = performance.now();

    engine.showHint();

    expect(engine.getSnapshot(startedAt + 2_000).hintCells).toHaveLength(4);
  });
});
