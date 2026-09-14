const LEVEL_BUNDLE_METADATA = {"version":"2.0.0","totalLevels":20000,"difficultyTotals":{"6x6":{"easy":2000,"medium":3900,"hard":3100},"8x8":{"easy":1500,"medium":3300,"hard":2200},"10x10":{"easy":600,"medium":1400,"hard":1000},"12x12":{"easy":300,"medium":400,"hard":300}},"generatedAt":"2026-09-02T15:06:14.354Z","source":"forest-trail-original-curated-catalog-v2","provenance":"original-seeded-generation; reference-game-structure-only; no-reference-puzzle-copying","generatedIncrement":17600,"qualityGates":{"allSizes":["schema-valid","standard-solution-valid","stable-id","unique-visible-constraint-fingerprint"],"6x6":["solver-unique","max-uniqueness-node-budget-250000"],"8x8-and-above":["offline-standard-solution-valid","path-wall-compatible","runtime-unique-status-not-claimed"]},"delivery":"compact-sharded-seed-records-v1","runtimeLoad":"load one size-difficulty bucket on demand","recordEncoding":"generated records keep stable seed; legacy records use compressed solution and waypoint indexes","bucketCounts":{"6x6:easy":2000,"6x6:medium":3900,"6x6:hard":3100,"8x8:easy":1500,"8x8:medium":3300,"8x8:hard":2200,"10x10:easy":600,"10x10:medium":1400,"10x10:hard":1000,"12x12:easy":300,"12x12:medium":400,"12x12:hard":300}};
const BUCKET_COUNTS = {"6x6:easy":2000,"6x6:medium":3900,"6x6:hard":3100,"8x8:easy":1500,"8x8:medium":3300,"8x8:hard":2200,"10x10:easy":600,"10x10:medium":1400,"10x10:hard":1000,"12x12:easy":300,"12x12:medium":400,"12x12:hard":300};
const BUCKET_LOADERS = {
  "6x6:easy": () => require("./records/6x6-easy.js"),
  "6x6:medium": () => require("./records/6x6-medium.js"),
  "6x6:hard": () => require("./records/6x6-hard.js"),
  "8x8:easy": () => require("./records/8x8-easy.js"),
  "8x8:medium": () => require("./records/8x8-medium.js"),
  "8x8:hard": () => require("./records/8x8-hard.js"),
  "10x10:easy": () => require("./records/10x10-easy.js"),
  "10x10:medium": () => require("./records/10x10-medium.js"),
  "10x10:hard": () => require("./records/10x10-hard.js"),
  "12x12:easy": () => require("./records/12x12-easy.js"),
  "12x12:medium": () => require("./records/12x12-medium.js"),
  "12x12:hard": () => require("./records/12x12-hard.js")
};
function loadBucket(gridSize, difficulty) { const loader = BUCKET_LOADERS[`${gridSize}:${difficulty}`]; return loader ? loader() : []; }
module.exports = { LEVEL_BUNDLE_METADATA, BUCKET_COUNTS, loadBucket };
