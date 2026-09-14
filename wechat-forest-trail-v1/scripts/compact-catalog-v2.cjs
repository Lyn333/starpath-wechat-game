const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const catalogDirectory = path.join(root, "catalog");
const expandedPath = path.join(catalogDirectory, "launchCatalog.js");
const recordsDirectory = path.join(catalogDirectory, "records");
const manifestPath = path.join(catalogDirectory, "catalogManifest.js");
const quotaPath = path.join(catalogDirectory, "catalog-quota-v2.json");
const reportPath = path.join(catalogDirectory, "catalog-compact-build-v2-report.json");
const externalSourceDirectory = path.resolve(root, "..", "catalog-expanded-source-v2");
const externalSourcePath = path.join(externalSourceDirectory, "launchCatalog.js");
const quota = JSON.parse(fs.readFileSync(quotaPath, "utf8"));
const { LEVELS, LEVEL_BUNDLE_METADATA } = require(expandedPath);
const sizes = ["6x6", "8x8", "10x10", "12x12"];
const difficulties = ["easy", "medium", "hard"];

function encodeIndexes(indexes) { return String.fromCharCode(...indexes.map((index) => index + 33)); }
function solutionIndexes(level) { return level.solution.map((cell) => cell.row * level.cols + cell.col); }
function legacyRecord(level) {
  const indexes = solutionIndexes(level);
  const positionByCell = new Map(indexes.map((cell, index) => [cell, index]));
  const waypointIndexes = level.waypoints.map((waypoint) => positionByCell.get(waypoint.cell.row * level.cols + waypoint.cell.col));
  if (waypointIndexes.some((index) => index === undefined)) throw new Error(`路标无法压缩：${level.id}`);
  return ["l", level.id, level.title || level.id, encodeIndexes(indexes), encodeIndexes(waypointIndexes), level.walls];
}
function generatedRecord(level) {
  if (!level.seed) throw new Error(`生成题缺少 Seed：${level.id}`);
  return ["s", level.id, level.title || level.id, level.seed];
}
function bucketKey(size, difficulty) { return `${size}:${difficulty}`; }
function bucketFilename(size, difficulty) { return `${size}-${difficulty}.js`; }
function sourceForRecords(records) { return `module.exports = ${JSON.stringify(records)};\n`; }
function manifestSource(metadata, counts) {
  const loaders = Object.entries(counts).map(([key]) => {
    const [size, difficulty] = key.split(":");
    return `${JSON.stringify(key)}: () => require(${JSON.stringify(`./records/${bucketFilename(size, difficulty)}`)})`;
  }).join(",\n  ");
  return `const LEVEL_BUNDLE_METADATA = ${JSON.stringify(metadata)};\nconst BUCKET_COUNTS = ${JSON.stringify(counts)};\nconst BUCKET_LOADERS = {\n  ${loaders}\n};\nfunction loadBucket(gridSize, difficulty) { const loader = BUCKET_LOADERS[\`${'${gridSize}'}:${'${difficulty}'}\`]; return loader ? loader() : []; }\nmodule.exports = { LEVEL_BUNDLE_METADATA, BUCKET_COUNTS, loadBucket };\n`;
}

const buckets = Object.fromEntries(sizes.flatMap((size) => difficulties.map((difficulty) => [bucketKey(size, difficulty), []])));
for (const level of LEVELS) {
  const key = bucketKey(level.gridSize, level.difficulty);
  if (!buckets[key]) throw new Error(`不支持的关卡规格：${level.id}`);
  buckets[key].push(level.seed ? generatedRecord(level) : legacyRecord(level));
}
const counts = Object.fromEntries(Object.entries(buckets).map(([key, records]) => [key, records.length]));
for (const size of sizes) for (const difficulty of difficulties) {
  const expected = quota.targetTotals[size][difficulty];
  if (counts[bucketKey(size, difficulty)] !== expected) throw new Error(`${size}/${difficulty} 分桶数错误：${counts[bucketKey(size, difficulty)]}/${expected}`);
}
if (Object.values(counts).reduce((sum, value) => sum + value, 0) !== quota.targetTotal) throw new Error("紧凑题库总量错误。");

const tempRecordsDirectory = `${recordsDirectory}.tmp`;
fs.rmSync(tempRecordsDirectory, { recursive: true, force: true });
fs.mkdirSync(tempRecordsDirectory, { recursive: true });
for (const size of sizes) for (const difficulty of difficulties) {
  const key = bucketKey(size, difficulty);
  fs.writeFileSync(path.join(tempRecordsDirectory, bucketFilename(size, difficulty)), sourceForRecords(buckets[key]));
}
const metadata = {
  ...LEVEL_BUNDLE_METADATA,
  delivery: "compact-sharded-seed-records-v1",
  runtimeLoad: "load one size-difficulty bucket on demand",
  recordEncoding: "generated records keep stable seed; legacy records use compressed solution and waypoint indexes",
  bucketCounts: counts,
};
const tempManifestPath = `${manifestPath}.tmp`;
fs.writeFileSync(tempManifestPath, manifestSource(metadata, counts));
fs.mkdirSync(externalSourceDirectory, { recursive: true });
fs.copyFileSync(expandedPath, externalSourcePath);
fs.rmSync(recordsDirectory, { recursive: true, force: true });
fs.renameSync(tempRecordsDirectory, recordsDirectory);
fs.renameSync(tempManifestPath, manifestPath);
fs.unlinkSync(expandedPath);
const recordBytes = fs.readdirSync(recordsDirectory).reduce((sum, file) => sum + fs.statSync(path.join(recordsDirectory, file)).size, 0);
const manifestBytes = fs.statSync(manifestPath).size;
const report = {
  catalogVersion: LEVEL_BUNDLE_METADATA.version,
  totalLevels: LEVELS.length,
  bucketCounts: counts,
  generatedSeedRecords: LEVELS.filter((level) => level.seed).length,
  compressedLegacyRecords: LEVELS.filter((level) => !level.seed).length,
  recordBytes,
  manifestBytes,
  expandedSourceBytes: fs.statSync(externalSourcePath).size,
  externalSourcePath,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
