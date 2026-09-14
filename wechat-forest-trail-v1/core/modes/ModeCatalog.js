const MODE_IDS = { DAILY: "daily", UNLIMITED: "unlimited", PROGRESSIVE: "progressive", CLOCK: "clock" };

const CLOCK_TIERS = {
  easy: { id: "easy", label: "简单", gridSize: "6x6", gridSizes: ["6x6", "8x8"], difficulty: "easy", bonusMs: 10000 },
  medium: { id: "medium", label: "中等", gridSize: "8x8", gridSizes: ["6x6", "8x8"], difficulty: "medium", bonusMs: 7000 },
  hard: { id: "hard", label: "困难", gridSize: "10x10", gridSizes: ["8x8", "10x10"], difficulty: "hard", bonusMs: 5000 },
  expert: { id: "expert", label: "专家", gridSize: "12x12", gridSizes: ["8x8", "10x10", "12x12"], difficulty: "hard", bonusMs: 3000 },
};

function chinaDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function dailyRequest(date = new Date()) {
  const day = chinaDateKey(date);
  return {
    mode: MODE_IDS.DAILY,
    gridSize: "8x8",
    difficulty: "medium",
    sourceKind: "daily",
    seed: `forest-trail:daily:v2:Asia/Shanghai:${day}`,
    title: `每日挑战 · ${day}`,
    challengeDate: day,
  };
}

function progressiveRequest(level = 1) {
  const current = Math.max(1, Math.floor(level));
  let gridSize = "4x4", difficulty = "easy";
  if (current >= 5) gridSize = "6x6";
  if (current >= 13) { gridSize = "8x8"; difficulty = "medium"; }
  if (current >= 25) { gridSize = "10x10"; difficulty = "medium"; }
  if (current >= 41) { gridSize = "10x10"; difficulty = "hard"; }
  if (current >= 61) { gridSize = "12x12"; difficulty = "hard"; }
  return {
    mode: MODE_IDS.PROGRESSIVE,
    gridSize,
    difficulty,
    sourceKind: "progressive",
    seed: `forest-trail:progressive:v2:${current}:${gridSize}:${difficulty}`,
    title: `渐进挑战 · Level ${current}`,
    progressiveLevel: current,
  };
}

const CLOCK_WAVE_SIZE = 3;

function clockGridSize(tier, solvedThisRun = 0) {
  const wave = Math.floor(Math.max(0, Math.floor(solvedThisRun)) / CLOCK_WAVE_SIZE);
  return tier.gridSizes[Math.min(tier.gridSizes.length - 1, wave)];
}

// ordinal 只用于让 Seed 在多局之间不重复；棋盘尺寸只由本局已解题数决定。
function clockRequest(tierId = "easy", ordinal = 1, solvedThisRun = 0) {
  const tier = CLOCK_TIERS[tierId] || CLOCK_TIERS.easy;
  const current = Math.max(1, Math.floor(ordinal));
  const gridSize = clockGridSize(tier, solvedThisRun);
  return {
    mode: MODE_IDS.CLOCK,
    gridSize,
    difficulty: tier.difficulty,
    sourceKind: "clock",
    seed: `forest-trail:clock:v2:${tier.id}:${current}:${gridSize}`,
    title: `时间挑战 · ${tier.label} · ${current}`,
    clockTier: tier.id,
    clockOrdinal: current,
    bonusMs: tier.bonusMs,
  };
}

function unlimitedRequest({ gridSize = "6x6", difficulty = "easy", ordinal = 1 } = {}) {
  const current = Math.max(1, Math.floor(ordinal));
  return {
    mode: MODE_IDS.UNLIMITED,
    gridSize,
    difficulty,
    sourceKind: "continuation",
    seed: `forest-trail:unlimited:v2:${gridSize}:${difficulty}:${current}`,
    title: `无限林径 · ${current}`,
    ordinal: current,
  };
}

module.exports = { CLOCK_TIERS, CLOCK_WAVE_SIZE, MODE_IDS, chinaDateKey, clockGridSize, clockRequest, dailyRequest, progressiveRequest, unlimitedRequest };
