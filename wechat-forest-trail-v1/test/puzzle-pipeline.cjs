const assert = require("assert");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { validatePuzzle } = require("../core/puzzle/PuzzleValidator");

const pipeline = new PuzzlePipeline({ maxAttempts: 8, uniquenessNodeBudget: 250000 });
const request = { gridSize: "6x6", difficulty: "medium", seed: "architecture-test-v1", sourceKind: "test" };
const first = pipeline.build(request);
const second = pipeline.build(request);
assert.strictEqual(first.id, second.id);
assert.deepStrictEqual(first.solution, second.solution);
assert.deepStrictEqual(first.walls, second.walls);
assert.deepStrictEqual(first.waypoints, second.waypoints);
assert.strictEqual(first.generation.validation, "unique");
assert.strictEqual(validatePuzzle(first).standardSolution.valid, true);

const profiles = ["easy", "medium", "hard"].map((difficulty) => pipeline.build({ gridSize: "6x6", difficulty, seed: `profile-${difficulty}`, sourceKind: "test" }));
assert.ok(profiles[0].waypoints.length > profiles[1].waypoints.length);
assert.ok(profiles[1].waypoints.length > profiles[2].waypoints.length);

const large = pipeline.build({ gridSize: "8x8", difficulty: "hard", seed: "large-standard-v1", sourceKind: "test", checkUniqueness: false });
assert.strictEqual(large.generation.validation, "standard-solution");
assert.strictEqual(validatePuzzle(large).standardSolution.valid, true);
console.log("PASS puzzle-pipeline");
