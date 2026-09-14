const assert = require("assert");
const before = process.memoryUsage().heapUsed;
const manifestStarted = process.hrtime.bigint();
const catalog = require("../catalog/catalogManifest");
const manifestMs = Number(process.hrtime.bigint() - manifestStarted) / 1e6;
const afterManifest = process.memoryUsage().heapUsed;
const bucketStarted = process.hrtime.bigint();
const bucket = catalog.loadBucket("6x6", "easy");
const bucketMs = Number(process.hrtime.bigint() - bucketStarted) / 1e6;
const afterBucket = process.memoryUsage().heapUsed;
const { hydrateCatalogRecord } = require("../core/providers/CompactCatalog");
const hydrateStarted = process.hrtime.bigint();
const level = hydrateCatalogRecord(bucket.find((record) => record[0] === "s") || bucket[0], { gridSize: "6x6", difficulty: "easy" });
const hydrateMs = Number(process.hrtime.bigint() - hydrateStarted) / 1e6;
assert.strictEqual(catalog.LEVEL_BUNDLE_METADATA.totalLevels, 20000);
assert.strictEqual(bucket.length, 2000);
assert.strictEqual(level.gridSize, "6x6");
console.log(JSON.stringify({
  manifestLoadMs: Number(manifestMs.toFixed(2)),
  manifestHeapDeltaMb: Number(((afterManifest - before) / (1024 * 1024)).toFixed(2)),
  bucketLoadMs: Number(bucketMs.toFixed(2)),
  bucketHeapDeltaMb: Number(((afterBucket - afterManifest) / (1024 * 1024)).toFixed(2)),
  singleHydrationMs: Number(hydrateMs.toFixed(2)),
  levels: catalog.LEVEL_BUNDLE_METADATA.totalLevels,
  bucketRecords: bucket.length,
}));
