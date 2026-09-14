const assert = require("assert");
const { LEVEL_BUNDLE_METADATA, BUCKET_COUNTS, loadBucket } = require("../catalog/catalogManifest");
const { hydrateCatalogRecord, recordId } = require("../core/providers/CompactCatalog");
const { validatePuzzle } = require("../core/puzzle/PuzzleValidator");

const expected = {
  "6x6:easy": 2000, "6x6:medium": 3900, "6x6:hard": 3100,
  "8x8:easy": 1500, "8x8:medium": 3300, "8x8:hard": 2200,
  "10x10:easy": 600, "10x10:medium": 1400, "10x10:hard": 1000,
  "12x12:easy": 300, "12x12:medium": 400, "12x12:hard": 300,
};
assert.strictEqual(LEVEL_BUNDLE_METADATA.version, "2.0.0");
assert.strictEqual(LEVEL_BUNDLE_METADATA.totalLevels, 20000);
assert.deepStrictEqual(BUCKET_COUNTS, expected);

const ids = new Set();
let total = 0, generated = 0, legacy = 0;
for (const [key, count] of Object.entries(expected)) {
  const [gridSize, difficulty] = key.split(":");
  const records = loadBucket(gridSize, difficulty);
  assert.strictEqual(records.length, count, `${key} 数量错误`);
  for (const record of records) {
    const id = recordId(record);
    assert.ok(id && !ids.has(id), `题目 ID 重复或缺失：${id}`);
    ids.add(id); total += 1;
    if (record[0] === "s") {
      generated += 1;
      assert.strictEqual(record.length, 4);
      assert.ok(record[3].startsWith("forest-trail-original-catalog-v2:"));
    } else if (record[0] === "l") {
      legacy += 1;
      const level = hydrateCatalogRecord(record, { gridSize, difficulty });
      const validation = validatePuzzle(level, { checkUniqueness: false });
      assert.strictEqual(validation.standardSolution.valid, true, `${id}: ${validation.standardSolution.issues.join("；")}`);
    } else throw new Error(`未知记录类型：${record[0]}`);
  }
  const sample = records.find((record) => record[0] === "s") || records[0];
  const hydrated = hydrateCatalogRecord(sample, { gridSize, difficulty });
  assert.strictEqual(hydrated.id, recordId(sample));
  assert.strictEqual(validatePuzzle(hydrated, { checkUniqueness: false }).standardSolution.valid, true, `${key} 抽样还原失败`);
}
assert.strictEqual(total, 20000);
assert.strictEqual(generated, 17600);
assert.strictEqual(legacy, 2400);
console.log(`PASS catalog-validation (${total} compact records; ${generated} original generated additions)`);
