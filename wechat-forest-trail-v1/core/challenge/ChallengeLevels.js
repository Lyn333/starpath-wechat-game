/**
 * 关卡挑战：水果乐园（全覆盖记忆盲连）与太空旅行（点选连线）两套主题、每套 5 关。
 *
 * 水果乐园见 `FruitParadise.js`：相邻拖动、覆盖全盘、10 秒记忆弹窗后全部隐藏。
 * 太空旅行仍按目标图案顺序点选（任意两格连线，不要求覆盖全盘）；直线穿过障碍格则拒绝。
 *
 * 坐标：策划案用 1 基的 R 行 C 列（左上角 R1C1）；这里统一转换为 0 基 {row, col}。
 */

const { lineCrossesBlocked } = require("./ChallengeEngine");
const { FRUIT_LEVELS, validateFruitCoverLayout } = require("./FruitParadise");

const THEMES = [
  { id: "fruit", label: "水果乐园", icon: "🍎" },
  { id: "space", label: "太空旅行", icon: "🚀" },
];

const SPACE_ICONS = {
  火箭: "🚀", 月亮: "🌙", 太阳: "☀️", 地球: "🌍", 土星: "🪐", 星星: "⭐",
  小行星: "🪨", 彗星: "☄️", 黑洞: "🕳️", 空间站: "🛰️", 外星人: "👽", 星云: "🌌",
  卫星: "📡", 太空舱: "🛸", 探测器: "🔭", 虫洞: "🌀", 银河: "✨", 超新星: "💥",
};

function rc(r, c) { return { row: r - 1, col: c - 1 }; }

const REWARD_SKINS = { fruit: "fruit-grove", space: "nebula-night" };

function defaultMemoryMode(hidden, index) {
  if (!hidden) return null;
  if (index === 3) return "faded";
  if (index === 5) return "flash";
  return "hidden";
}

function buildSpace({ id, theme, index, title, gridSize, difficulty, previewMs, hidden, memoryMode, showTargetName = false, targetMs, threeStarMs, icons, seq, blocked = [] }) {
  const [rows, cols] = gridSize.split("x").map(Number);
  const waypoints = seq.map(([name, r, c], position) => ({ number: position + 1, cell: rc(r, c), icon: icons[name] || "●", name }));
  return {
    id, theme, index, title, gridSize, rows, cols, difficulty,
    sourceKind: "challenge", playStyle: "tap-sequence", requireFullCoverage: false, walls: [],
    blockedCells: blocked.map(([r, c]) => rc(r, c)),
    waypoints, previewMs, hidden, memoryMode: memoryMode === undefined ? defaultMemoryMode(hidden, index) : memoryMode,
    showTargetName, targetMs, threeStarMs, categories: [],
  };
}

const SPACE_LEVELS = [
  buildSpace({
    id: "challenge-space-1", theme: "space", index: 1, title: "离开地球", gridSize: "6x6", difficulty: "easy",
    previewMs: 4000, hidden: false, targetMs: 35000, threeStarMs: 25000, icons: SPACE_ICONS,
    seq: [["火箭", 6, 1], ["月亮", 2, 3], ["太阳", 1, 6], ["地球", 4, 2], ["土星", 3, 5], ["星星", 6, 6], ["小行星", 2, 6], ["彗星", 5, 4]],
  }),
  buildSpace({
    id: "challenge-space-2", theme: "space", index: 2, title: "行星轨道", gridSize: "6x6", difficulty: "easy",
    previewMs: 5000, hidden: false, targetMs: 60000, threeStarMs: 45000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 2], ["月亮", 3, 6], ["太阳", 6, 5], ["地球", 4, 1], ["土星", 2, 4], ["星星", 5, 2], ["小行星", 1, 6], ["彗星", 6, 1], ["黑洞", 4, 5], ["空间站", 2, 1], ["外星人", 5, 6], ["星云", 3, 3]],
  }),
  buildSpace({
    id: "challenge-space-3", theme: "space", index: 3, title: "失重记忆", gridSize: "6x6", difficulty: "medium",
    previewMs: 5000, hidden: true, targetMs: 80000, threeStarMs: 60000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 5, 5], ["太阳", 2, 4], ["地球", 6, 2], ["土星", 3, 6], ["星星", 4, 1], ["小行星", 6, 6], ["彗星", 2, 1], ["黑洞", 5, 3], ["空间站", 3, 2], ["外星人", 4, 5], ["星云", 1, 6], ["卫星", 6, 4], ["太空舱", 2, 6]],
  }),
  buildSpace({
    id: "challenge-space-4", theme: "space", index: 4, title: "小行星带", gridSize: "8x8", difficulty: "hard",
    previewMs: 6000, hidden: true, targetMs: 105000, threeStarMs: 82000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 2, 6], ["太阳", 5, 8], ["地球", 8, 3], ["土星", 6, 1], ["星星", 3, 4], ["小行星", 1, 7], ["彗星", 4, 8], ["黑洞", 7, 6], ["空间站", 2, 2], ["外星人", 5, 3], ["星云", 8, 8], ["卫星", 6, 5], ["太空舱", 3, 1]],
    blocked: [[1, 5], [1, 8], [2, 1], [4, 5], [5, 6], [6, 3], [7, 8], [8, 5]],
  }),
  buildSpace({
    id: "challenge-space-5", theme: "space", index: 5, title: "穿越星云", gridSize: "8x8", difficulty: "hard",
    previewMs: 7000, hidden: true, targetMs: 150000, threeStarMs: 115000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 8, 8], ["太阳", 2, 5], ["地球", 6, 2], ["土星", 3, 7], ["星星", 5, 5], ["小行星", 1, 6], ["彗星", 7, 7], ["黑洞", 4, 2], ["空间站", 8, 3], ["外星人", 2, 1], ["星云", 6, 6], ["卫星", 3, 3], ["太空舱", 5, 8], ["探测器", 7, 1], ["虫洞", 4, 6], ["银河", 1, 4], ["超新星", 8, 5]],
    blocked: [[1, 3], [1, 5], [1, 7], [2, 7], [3, 8], [5, 1], [6, 1], [7, 4], [8, 2], [8, 6]],
  }),
];

const CHALLENGE_LEVELS = [...FRUIT_LEVELS, ...SPACE_LEVELS];
const LEVELS_BY_ID = new Map(CHALLENGE_LEVELS.map((level) => [level.id, level]));

function getChallengeLevel(id) { return LEVELS_BY_ID.get(id) || null; }

function challengeThemeList() {
  return THEMES.map((theme) => ({ ...theme, levels: CHALLENGE_LEVELS.filter((level) => level.theme === theme.id), skinId: REWARD_SKINS[theme.id] }));
}

function challengeRewardProgress(completed = {}, stars = {}) {
  return THEMES.map((theme) => {
    const levels = CHALLENGE_LEVELS.filter((level) => level.theme === theme.id);
    const cleared = levels.filter((level) => completed[level.id]).length;
    const starCount = levels.reduce((sum, level) => sum + Math.max(0, Math.min(3, Number(stars[level.id]) || 0)), 0);
    return {
      id: theme.id, label: theme.label, icon: theme.icon, skinId: REWARD_SKINS[theme.id],
      cleared, total: levels.length, stars: starCount, maxStars: levels.length * 3,
      complete: cleared === levels.length, perfect: starCount === levels.length * 3,
    };
  });
}

function isRewardSkinUnlocked(skinId, completed = {}) {
  const theme = THEMES.find((item) => REWARD_SKINS[item.id] === skinId);
  if (!theme) return true;
  return challengeRewardProgress(completed).find((item) => item.id === theme.id)?.complete === true;
}

function challengeRhythmView() {
  return null;
}

function validateChallengeLevel(level) {
  if (level.playStyle === "fruit-cover") return validateFruitCoverLayout(level);
  const seen = new Set();
  const blocked = new Set((level.blockedCells || []).map((cell) => `${cell.row}-${cell.col}`));
  level.waypoints.forEach((waypoint, index) => {
    if (waypoint.number !== index + 1) throw new Error(`${level.id}：图案顺序必须从 1 连续递增。`);
    const { row, col } = waypoint.cell;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= level.rows || col < 0 || col >= level.cols) throw new Error(`${level.id}：图案 ${waypoint.name} 越界。`);
    const key = `${row}-${col}`;
    if (seen.has(key)) throw new Error(`${level.id}：图案 ${waypoint.name} 与其他图案重叠。`);
    if (blocked.has(key)) throw new Error(`${level.id}：图案 ${waypoint.name} 落在障碍格上。`);
    seen.add(key);
  });
  const blockedSeen = new Set();
  (level.blockedCells || []).forEach((cell) => {
    const { row, col } = cell;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= level.rows || col < 0 || col >= level.cols) throw new Error(`${level.id}：障碍格越界。`);
    const key = `${row}-${col}`;
    if (blockedSeen.has(key)) throw new Error(`${level.id}：障碍格重复。`);
    blockedSeen.add(key);
  });
  const modes = new Set([null, undefined, "faded", "hidden", "flash"]);
  if (!modes.has(level.memoryMode)) throw new Error(`${level.id}：未知记忆模式 ${level.memoryMode}。`);
  if (level.memoryMode && !level.hidden) throw new Error(`${level.id}：记忆模式需要 hidden 预览。`);
  for (let index = 1; index < level.waypoints.length; index += 1) {
    if (lineCrossesBlocked(level.waypoints[index - 1].cell, level.waypoints[index].cell, blocked)) {
      throw new Error(`${level.id}：第 ${index} 到 ${index + 1} 个图案的连线穿过障碍。`);
    }
  }
  return true;
}

module.exports = {
  CHALLENGE_LEVELS, THEMES, REWARD_SKINS, SPACE_LEVELS,
  getChallengeLevel, challengeThemeList, challengeRewardProgress, isRewardSkinUnlocked, challengeRhythmView, validateChallengeLevel,
};
