const fs = require("fs");
const path = require("path");
const { PuzzlePipeline } = require("../core/puzzle/PuzzlePipeline");
const { validatePuzzle } = require("../core/puzzle/PuzzleValidator");
const { createCatalogPipeline, hydrateCatalogRecord } = require("../core/providers/CompactCatalog");

const root = path.resolve(__dirname, "..");
const runtimeCatalogPath = path.join(root, "catalog", "launchCatalog.js");
const reusableSourcePath = path.resolve(root, "..", "catalog-expanded-source-v2", "launchCatalog.js");
const sourceCatalogPath = fs.existsSync(runtimeCatalogPath) ? runtimeCatalogPath : reusableSourcePath;
const quotaPath = path.join(root, "catalog", "catalog-quota-v2.json");
const reportPath = path.join(root, "catalog", "catalog-build-v2-report.json");
const quota = JSON.parse(fs.readFileSync(quotaPath, "utf8"));
const sizes = ["6x6", "8x8", "10x10", "12x12"];
const difficulties = ["easy", "medium", "hard"];
const pipeline = new PuzzlePipeline({ maxAttempts: 12, uniquenessMaxSize: 6, uniquenessNodeBudget: 250000, generationNodeBudget: 500000, uniquenessWallBudget: 24 });

function loadExistingLevels() {
  if (fs.existsSync(sourceCatalogPath)) return require(sourceCatalogPath).LEVELS || [];
  const { loadBucket } = require("../catalog/catalogManifest");
  const restorePipeline = createCatalogPipeline();
  return sizes.flatMap((gridSize) => difficulties.flatMap((difficulty) => loadBucket(gridSize, difficulty).map((record) => hydrateCatalogRecord(record, { gridSize, difficulty, pipeline: restorePipeline }))));
}

const existingLevels = loadExistingLevels();

function tally(levels) {
  const totals = Object.fromEntries(sizes.map((size) => [size, Object.fromEntries(difficulties.map((difficulty) => [difficulty, 0]))]));
  levels.forEach((level) => {
    if (totals[level.gridSize]?.[level.difficulty] !== undefined) totals[level.gridSize][level.difficulty] += 1;
  });
  return totals;
}

function visibleFingerprint(level) {
  const waypoints = level.waypoints.map((item) => `${item.number}:${item.cell.row},${item.cell.col}`).join("|");
  return `${level.gridSize}#${level.difficulty}#${level.walls.join(",")}#${waypoints}`;
}

function titleFor(gridSize, difficulty, ordinal) {
  const labels = { easy: "晨光", medium: "林径", hard: "深林" };
  return `${labels[difficulty]} · ${gridSize} · ${String(ordinal).padStart(5, "0")}`;
}

function assertExistingCatalog(levels) {
  const ids = new Set();
  const fingerprints = new Set();
  for (const level of levels) {
    if (ids.has(level.id)) throw new Error(`现有题库存在重复 ID：${level.id}`);
    ids.add(level.id);
    const fingerprint = visibleFingerprint(level);
    if (fingerprints.has(fingerprint)) throw new Error(`现有题库存在重复可见约束：${level.id}`);
    fingerprints.add(fingerprint);
    const validation = validatePuzzle(level, { checkUniqueness: false });
    if (!validation.standardSolution.valid) throw new Error(`现有题库标准解无效：${level.id}：${validation.standardSolution.issues.join("；")}`);
  }
  return { ids, fingerprints };
}

function buildCatalog() {
  const startedAt = Date.now();
  const { ids, fingerprints } = assertExistingCatalog(existingLevels);
  const levels = [...existingLevels];
  const generated = [];
  const attemptsByBucket = {};
  const totals = tally(levels);

  for (const gridSize of sizes) {
    for (const difficulty of difficulties) {
      const target = quota.targetTotals[gridSize][difficulty];
      const current = totals[gridSize][difficulty];
      const needed = target - current;
      if (needed < 0) throw new Error(`${gridSize}/${difficulty} 的现有数量超过目标：${current}/${target}`);
      const bucketKey = `${gridSize}/${difficulty}`;
      attemptsByBucket[bucketKey] = 0;
      let ordinal = current + 1;
      let seedOrdinal = 1;
      while (totals[gridSize][difficulty] < target) {
        attemptsByBucket[bucketKey] += 1;
        if (attemptsByBucket[bucketKey] > Math.max(needed * 30, 100)) throw new Error(`${bucketKey} 未能在质量门禁内补齐。`);
        const id = `catalog-v2-${gridSize}-${difficulty}-${String(ordinal).padStart(5, "0")}`;
        const seed = `forest-trail-original-catalog-v2:${gridSize}:${difficulty}:${seedOrdinal}`;
        seedOrdinal += 1;
        let puzzle;
        try {
          puzzle = pipeline.build({ gridSize, difficulty, seed, sourceKind: "catalog", title: titleFor(gridSize, difficulty, ordinal) });
        } catch (_) { continue; }
        if (puzzle.generation.pathSource !== "warnsdorff") continue;
        const fingerprint = visibleFingerprint(puzzle);
        if (ids.has(id) || fingerprints.has(fingerprint)) continue;
        if (gridSize === "6x6" && puzzle.generation.validation !== "unique") continue;
        const validation = validatePuzzle(puzzle, { checkUniqueness: false });
        if (!validation.standardSolution.valid) continue;
        levels.push({ ...puzzle, id });
        generated.push({ ...puzzle, id });
        ids.add(id);
        fingerprints.add(fingerprint);
        totals[gridSize][difficulty] += 1;
        ordinal += 1;
      }
    }
  }

  const totalLevels = levels.length;
  if (totalLevels !== quota.targetTotal) throw new Error(`题库总量错误：${totalLevels}/${quota.targetTotal}`);
  for (const gridSize of sizes) for (const difficulty of difficulties) {
    if (totals[gridSize][difficulty] !== quota.targetTotals[gridSize][difficulty]) throw new Error(`${gridSize}/${difficulty} 配额错误。`);
  }

  const metadata = {
    version: quota.catalogVersion,
    totalLevels,
    difficultyTotals: totals,
    generatedAt: new Date().toISOString(),
    source: "forest-trail-original-curated-catalog-v2",
    provenance: "original-seeded-generation; reference-game-structure-only; no-reference-puzzle-copying",
    generatedIncrement: generated.length,
    qualityGates: quota.qualityGates,
  };
  const source = `const LEVEL_BUNDLE_METADATA = ${JSON.stringify(metadata)};\nconst LEVELS = ${JSON.stringify(levels)};\nmodule.exports = { LEVELS, LEVEL_BUNDLE_METADATA };\n`;
  const tempPath = `${runtimeCatalogPath}.tmp`;
  fs.writeFileSync(tempPath, source);
  fs.renameSync(tempPath, runtimeCatalogPath);
  const report = {
    catalogVersion: quota.catalogVersion,
    targetTotal: quota.targetTotal,
    existingCount: existingLevels.length,
    generatedCount: generated.length,
    finalCount: totalLevels,
    difficultyTotals: totals,
    attemptsByBucket,
    elapsedMs: Date.now() - startedAt,
    qualityGates: quota.qualityGates,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

buildCatalog();
