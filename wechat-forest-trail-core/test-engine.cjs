const assert = require("node:assert/strict");
const { TrailEngine } = require("./core/TrailEngine");
const { mossGrove6x6 } = require("./levels/mossGrove6x6");

const engine = new TrailEngine(mossGrove6x6);
assert.equal(engine.getSnapshot().status, "idle");
assert.equal(engine.tryMove({ row: 2, col: 2 }), false, "必须从 1 号路标开始");

for (const cell of mossGrove6x6.solution) {
  assert.equal(engine.tryMove(cell), true, `预设解法应可走到 ${cell.row}-${cell.col}`);
}
assert.equal(engine.getSnapshot().status, "completed");
assert.equal(engine.getSnapshot().moves, 35);

engine.reset();
engine.tryMove({ row: 0, col: 0 });
engine.tryMove({ row: 0, col: 1 });
engine.undo();
assert.deepEqual(engine.getSnapshot().path, [{ row: 0, col: 0 }]);
console.log("TrailEngine tests passed");
