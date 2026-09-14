const assert = require("assert");
const { TrailEngine } = require("../core/TrailEngine");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");

const puzzle = new PuzzlePipeline().build({ gridSize: "6x6", difficulty: "easy", seed: "restore-test-v1", sourceKind: "test" });
const first = new TrailEngine(puzzle);
for (const cell of puzzle.solution.slice(0, 7)) assert.strictEqual(first.tryMove(cell), true);
const state = first.serializeState();
const second = new TrailEngine(puzzle);
assert.strictEqual(second.restoreState(state), true);
assert.deepStrictEqual(second.getSnapshot().path, first.getSnapshot().path);
assert.strictEqual(second.getSnapshot().nextWaypoint, first.getSnapshot().nextWaypoint);
assert.strictEqual(second.getSnapshot().status, first.getSnapshot().status);
assert.strictEqual(second.restoreState({ ...state, levelId: "wrong" }), false);
console.log("PASS engine-restore");
