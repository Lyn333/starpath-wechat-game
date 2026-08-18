const assert = require("node:assert/strict");
(async () => {
  const { toNativeLevel, validate } = await import("../scripts/build-minigame-package.mjs");
  const level = toNativeLevel({ id: "sample", name: "样例", gridSize: "6x6", difficulty: "easy", waypoints: [{ number: 1, cell: { row: 0, col: 0 } }, { number: 2, cell: { row: 5, col: 5 } }], walls: [{ cell: { row: 0, col: 0 }, direction: "right" }], solution: Array.from({ length: 36 }, (_, index) => ({ row: Math.floor(index / 6), col: Math.floor(index / 6) % 2 ? 5 - index % 6 : index % 6 })) });
  assert.equal(level.walls[0], "V_0_0"); assert.equal(level.rows, 6); validate(level); console.log("题库格式转换校验通过");
})().catch((error) => { console.error(error); process.exitCode = 1; });
