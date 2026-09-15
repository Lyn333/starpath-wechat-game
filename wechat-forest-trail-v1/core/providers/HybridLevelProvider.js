const { normalizePuzzle } = require("../puzzle/PuzzleSchema");
const { hashString } = require("../puzzle/SeededRandom");
const { clockRequest, dailyRequest, unlimitedRequest } = require("../modes/ModeCatalog");
const { getChallengeLevel } = require("../challenge/ChallengeLevels");
const { createCatalogPipeline, hydrateCatalogRecord, recordId } = require("./CompactCatalog");

function poolKey(gridSize, difficulty) { return `${gridSize}:${difficulty}`; }

class HybridLevelProvider {
  constructor({ curatedLevels = [], catalog = null, progress, pipeline = createCatalogPipeline(), hydrationCacheLimit = 48 } = {}) {
    this.progress = progress;
    this.pipeline = pipeline;
    this.catalog = catalog;
    this.hydrationCacheLimit = hydrationCacheLimit;
    this.pools = new Map();
    this.compactPools = new Map();
    this.hydrated = new Map();
    for (const level of curatedLevels) {
      const key = poolKey(level.gridSize, level.difficulty);
      if (!this.pools.has(key)) this.pools.set(key, []);
      this.pools.get(key).push(level);
    }
  }

  getCompactPool(gridSize, difficulty) {
    const key = poolKey(gridSize, difficulty);
    if (this.compactPools.has(key)) return this.compactPools.get(key);
    let records = [];
    try { records = this.catalog?.loadBucket?.(gridSize, difficulty) || []; } catch (error) { console.warn(`题库分桶加载失败：${key}`, error); }
    this.compactPools.set(key, records);
    return records;
  }

  hydrateRecord(record, gridSize, difficulty) {
    const id = recordId(record);
    if (id && this.hydrated.has(id)) return this.hydrated.get(id);
    const level = hydrateCatalogRecord(record, { gridSize, difficulty, pipeline: this.pipeline });
    if (id) {
      this.hydrated.set(id, level);
      while (this.hydrated.size > this.hydrationCacheLimit) this.hydrated.delete(this.hydrated.keys().next().value);
    }
    return level;
  }

  selectCurated(gridSize, difficulty, ordinal, excludeId) {
    const key = poolKey(gridSize, difficulty);
    const expanded = this.pools.get(key) || [];
    const compact = this.getCompactPool(gridSize, difficulty);
    const total = expanded.length + compact.length;
    if (!total) return null;
    const start = hashString(`${gridSize}:${difficulty}:${ordinal}`) % total;
    const select = (index) => index < expanded.length
      ? normalizePuzzle({ ...expanded[index], sourceKind: expanded[index].sourceKind || "catalog" })
      : this.hydrateRecord(compact[index - expanded.length], gridSize, difficulty);
    for (let offset = 0; offset < total; offset += 1) {
      const level = select((start + offset) % total);
      if (level.id === excludeId || this.progress?.wasRecentlyPlayed?.(level.id) || this.progress?.isCompleted?.(level.id)) continue;
      return level;
    }
    for (let offset = 0; offset < total; offset += 1) {
      const level = select((start + offset) % total);
      if (level.id !== excludeId) return level;
    }
    return null;
  }

  buildGenerated(request) {
    const level = this.pipeline.build(request);
    return { ...level, ...Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)) };
  }

  nextUnlimited({ gridSize = "6x6", difficulty = "easy", excludeId } = {}) {
    const sequenceKey = `unlimited:${gridSize}:${difficulty}`;
    const ordinal = this.progress?.nextSequence?.(sequenceKey) || 1;
    const curated = this.selectCurated(gridSize, difficulty, ordinal, excludeId);
    const level = curated || this.buildGenerated(unlimitedRequest({ gridSize, difficulty, ordinal }));
    this.progress?.recordPresented?.(level);
    return level;
  }

  daily(date = new Date()) {
    const request = dailyRequest(date);
    const level = this.buildGenerated(request);
    this.progress?.recordPresented?.(level);
    return level;
  }

  challenge(levelId) {
    const level = getChallengeLevel(levelId);
    if (!level) throw new Error(`未知的关卡挑战：${levelId}`);
    this.progress?.recordPresented?.(level);
    return level;
  }

  clock(tierId = "easy", solvedThisRun = 0) {
    const ordinal = this.progress?.nextClock?.(tierId) || 1;
    const request = clockRequest(tierId, ordinal, solvedThisRun);
    const level = this.buildGenerated(request);
    this.progress?.recordPresented?.(level);
    return level;
  }

  stats() {
    const pools = {};
    const compactPools = {};
    for (const [key, levels] of this.pools.entries()) pools[key] = levels.length;
    for (const [key, records] of this.compactPools.entries()) compactPools[key] = records.length;
    const manifestTotal = Object.values(this.catalog?.BUCKET_COUNTS || {}).reduce((sum, count) => sum + count, 0);
    return { curatedTotal: Object.values(pools).reduce((sum, count) => sum + count, 0) + manifestTotal, pools, compactPools, hydrated: this.hydrated.size };
  }
}

module.exports = { HybridLevelProvider, poolKey };
