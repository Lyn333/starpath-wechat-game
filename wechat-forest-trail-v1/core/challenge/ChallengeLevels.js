/**
 * 关卡挑战：水果乐园 与 太空旅行 两套主题、每套 5 关。
 *
 * 玩法与“无限林径”的相邻拖动不同：关卡挑战按“目标图案顺序”依次点选棋盘上的图案
 * （即策划案中“任意两格之间连线”的版本），因此关卡一定可解，无需相邻自回避路径。
 *
 * 坐标：策划案用 1 基的 R 行 C 列（左上角 R1C1）；这里统一转换为 0 基 {row, col}。
 * 每关字段：id / theme / index / title / gridSize / rows / cols / difficulty /
 *          waypoints（按目标顺序，含 number、cell、icon、name）/ blockedCells（障碍格）/
 *          previewMs / hidden / targetMs / threeStarMs / sourceKind。
 */

const THEMES = [
  { id: "fruit", label: "水果乐园", icon: "🍎" },
  { id: "space", label: "太空旅行", icon: "🚀" },
];

const FRUIT_ICONS = {
  苹果: "🍎", 香蕉: "🍌", 西瓜: "🍉", 草莓: "🍓", 葡萄: "🍇", 橙子: "🍊",
  菠萝: "🍍", 桃子: "🍑", 蓝莓: "🫐", 猕猴桃: "🥝", 樱桃: "🍒", 柠檬: "🍋",
  苹果切片: "🍏", 水果篮: "🧺", 椰子: "🥥", 石榴: "🟥", 无花果: "🟪", 彩虹水果: "🌈",
};

const SPACE_ICONS = {
  火箭: "🚀", 月亮: "🌙", 太阳: "☀️", 地球: "🌍", 土星: "🪐", 星星: "⭐",
  小行星: "🪨", 彗星: "☄️", 黑洞: "🕳️", 空间站: "🛰️", 外星人: "👽", 星云: "🌌",
  卫星: "📡", 太空舱: "🛸", 探测器: "🔭", 虫洞: "🌀", 银河: "✨", 超新星: "💥",
};

function rc(r, c) { return { row: r - 1, col: c - 1 }; }

const REWARD_SKINS = { fruit: "fruit-grove", space: "nebula-night" };

const FRUIT_CATEGORIES = [
  { id: "sweet", label: "甜", color: "#FF6B8A", names: ["苹果", "草莓", "樱桃"] },
  { id: "sour", label: "酸", color: "#FFD35A", names: ["香蕉", "橙子", "柠檬"] },
  { id: "aroma", label: "果香", color: "#9B7CFF", names: ["葡萄", "蓝莓", "桃子"] },
  { id: "tropical", label: "热带", color: "#45B9A2", names: ["西瓜", "菠萝", "猕猴桃"] },
];

function build({ id, theme, index, title, gridSize, difficulty, previewMs, hidden, showTargetName = false, targetMs, threeStarMs, icons, seq, blocked = [], categories = [] }) {
  const [rows, cols] = gridSize.split("x").map(Number);
  const waypoints = seq.map(([name, r, c], position) => ({ number: position + 1, cell: rc(r, c), icon: icons[name] || "●", name }));
  return {
    id, theme, index, title, gridSize, rows, cols, difficulty,
    sourceKind: "challenge", requireFullCoverage: false, walls: [],
    blockedCells: blocked.map(([r, c]) => rc(r, c)),
    waypoints, previewMs, hidden, showTargetName, targetMs, threeStarMs, categories,
  };
}

const CHALLENGE_LEVELS = [
  build({
    id: "challenge-fruit-1", theme: "fruit", index: 1, title: "果园起步", gridSize: "6x6", difficulty: "easy",
    previewMs: 4000, hidden: false, targetMs: 35000, threeStarMs: 25000, icons: FRUIT_ICONS,
    seq: [["苹果", 1, 1], ["香蕉", 1, 6], ["西瓜", 3, 2], ["草莓", 2, 5], ["葡萄", 5, 6], ["橙子", 4, 3], ["菠萝", 6, 1], ["桃子", 6, 5]],
  }),
  build({
    id: "challenge-fruit-2", theme: "fruit", index: 2, title: "果园绕行", gridSize: "6x6", difficulty: "easy",
    previewMs: 5000, hidden: false, targetMs: 55000, threeStarMs: 42000, icons: FRUIT_ICONS,
    seq: [["苹果", 1, 2], ["香蕉", 2, 6], ["西瓜", 4, 5], ["草莓", 6, 6], ["葡萄", 5, 3], ["橙子", 3, 1], ["菠萝", 1, 5], ["桃子", 2, 2], ["蓝莓", 4, 2], ["猕猴桃", 6, 1], ["樱桃", 5, 5], ["柠檬", 3, 4]],
  }),
  build({
    id: "challenge-fruit-3", theme: "fruit", index: 3, title: "水果记忆秀", gridSize: "6x6", difficulty: "medium",
    previewMs: 5000, hidden: true, showTargetName: true, targetMs: 75000, threeStarMs: 58000, icons: FRUIT_ICONS,
    seq: [["苹果", 1, 1], ["香蕉", 6, 2], ["西瓜", 2, 4], ["草莓", 5, 6], ["葡萄", 3, 2], ["橙子", 4, 5], ["菠萝", 1, 6], ["桃子", 2, 1], ["蓝莓", 6, 6], ["猕猴桃", 4, 2], ["樱桃", 5, 1], ["柠檬", 3, 5], ["苹果切片", 2, 6], ["水果篮", 5, 3]],
  }),
  build({
    id: "challenge-fruit-4", theme: "fruit", index: 4, title: "甜酸分类挑战", gridSize: "8x8", difficulty: "hard",
    previewMs: 6000, hidden: true, targetMs: 90000, threeStarMs: 70000, icons: FRUIT_ICONS,
    seq: [["苹果", 1, 1], ["草莓", 2, 5], ["樱桃", 4, 8], ["香蕉", 8, 2], ["橙子", 6, 6], ["柠檬", 3, 3], ["葡萄", 1, 7], ["蓝莓", 7, 8], ["桃子", 5, 2], ["西瓜", 8, 7], ["菠萝", 4, 4], ["猕猴桃", 6, 1]],
    categories: FRUIT_CATEGORIES,
  }),
  build({
    id: "challenge-fruit-5", theme: "fruit", index: 5, title: "丰收终章", gridSize: "8x8", difficulty: "hard",
    previewMs: 7000, hidden: true, targetMs: 135000, threeStarMs: 105000, icons: FRUIT_ICONS,
    seq: [["苹果", 1, 1], ["香蕉", 8, 8], ["西瓜", 2, 6], ["草莓", 6, 3], ["葡萄", 3, 2], ["橙子", 7, 7], ["菠萝", 1, 7], ["桃子", 4, 5], ["蓝莓", 8, 2], ["猕猴桃", 5, 8], ["樱桃", 2, 1], ["柠檬", 6, 6], ["苹果切片", 3, 7], ["水果篮", 7, 1], ["椰子", 4, 2], ["石榴", 5, 4], ["无花果", 8, 5], ["彩虹水果", 1, 4]],
  }),
  build({
    id: "challenge-space-1", theme: "space", index: 1, title: "离开地球", gridSize: "6x6", difficulty: "easy",
    previewMs: 4000, hidden: false, targetMs: 35000, threeStarMs: 25000, icons: SPACE_ICONS,
    seq: [["火箭", 6, 1], ["月亮", 2, 3], ["太阳", 1, 6], ["地球", 4, 2], ["土星", 3, 5], ["星星", 6, 6], ["小行星", 2, 6], ["彗星", 5, 4]],
  }),
  build({
    id: "challenge-space-2", theme: "space", index: 2, title: "行星轨道", gridSize: "6x6", difficulty: "easy",
    previewMs: 5000, hidden: false, targetMs: 60000, threeStarMs: 45000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 2], ["月亮", 3, 6], ["太阳", 6, 5], ["地球", 4, 1], ["土星", 2, 4], ["星星", 5, 2], ["小行星", 1, 6], ["彗星", 6, 1], ["黑洞", 4, 5], ["空间站", 2, 1], ["外星人", 5, 6], ["星云", 3, 3]],
  }),
  build({
    id: "challenge-space-3", theme: "space", index: 3, title: "失重记忆", gridSize: "6x6", difficulty: "medium",
    previewMs: 5000, hidden: true, targetMs: 80000, threeStarMs: 60000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 5, 5], ["太阳", 2, 4], ["地球", 6, 2], ["土星", 3, 6], ["星星", 4, 1], ["小行星", 6, 6], ["彗星", 2, 1], ["黑洞", 5, 3], ["空间站", 3, 2], ["外星人", 4, 5], ["星云", 1, 6], ["卫星", 6, 4], ["太空舱", 2, 6]],
  }),
  build({
    id: "challenge-space-4", theme: "space", index: 4, title: "小行星带", gridSize: "8x8", difficulty: "hard",
    previewMs: 6000, hidden: true, targetMs: 105000, threeStarMs: 82000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 2, 6], ["太阳", 5, 8], ["地球", 8, 3], ["土星", 6, 1], ["星星", 3, 4], ["小行星", 1, 7], ["彗星", 4, 8], ["黑洞", 7, 6], ["空间站", 2, 2], ["外星人", 5, 3], ["星云", 8, 8], ["卫星", 6, 5], ["太空舱", 3, 1]],
    blocked: [[1, 4], [2, 4], [3, 6], [4, 3], [5, 6], [6, 7], [7, 2], [8, 5]],
  }),
  build({
    id: "challenge-space-5", theme: "space", index: 5, title: "穿越星云", gridSize: "8x8", difficulty: "hard",
    previewMs: 7000, hidden: true, targetMs: 150000, threeStarMs: 115000, icons: SPACE_ICONS,
    seq: [["火箭", 1, 1], ["月亮", 8, 8], ["太阳", 2, 5], ["地球", 6, 2], ["土星", 3, 7], ["星星", 5, 5], ["小行星", 1, 6], ["彗星", 7, 7], ["黑洞", 4, 2], ["空间站", 8, 3], ["外星人", 2, 1], ["星云", 6, 6], ["卫星", 3, 3], ["太空舱", 5, 8], ["探测器", 7, 1], ["虫洞", 4, 6], ["银河", 1, 4], ["超新星", 8, 5]],
    blocked: [[1, 3], [2, 7], [3, 5], [4, 4], [5, 2], [5, 7], [6, 4], [7, 5], [8, 2], [8, 7]],
  }),
];

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

function challengeRhythmView(level, snapshot = {}) {
  if (!level?.categories?.length) return null;
  const next = snapshot.nextWaypoint || 1;
  const groups = level.categories.map((category) => {
    const numbers = level.waypoints.filter((waypoint) => category.names.includes(waypoint.name)).map((waypoint) => waypoint.number);
    return {
      id: category.id, label: category.label, color: category.color, names: category.names,
      cells: level.waypoints.filter((waypoint) => category.names.includes(waypoint.name)).map((waypoint) => waypoint.cell),
      total: numbers.length, found: numbers.filter((number) => number < next).length, current: numbers.includes(next),
    };
  });
  return { active: true, groups, current: groups.find((group) => group.current) || null };
}

// 校验：图案顺序编号连续、坐标合法且互不重叠、不与障碍重叠；障碍合法且互不重叠。
function validateChallengeLevel(level) {
  const seen = new Set();
  const blocked = new Set(level.blockedCells.map((cell) => `${cell.row}-${cell.col}`));
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
  level.blockedCells.forEach((cell) => {
    const { row, col } = cell;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= level.rows || col < 0 || col >= level.cols) throw new Error(`${level.id}：障碍格越界。`);
    const key = `${row}-${col}`;
    if (blockedSeen.has(key)) throw new Error(`${level.id}：障碍格重复。`);
    blockedSeen.add(key);
  });
  return true;
}

module.exports = { CHALLENGE_LEVELS, THEMES, REWARD_SKINS, FRUIT_CATEGORIES, getChallengeLevel, challengeThemeList, challengeRewardProgress, isRewardSkinUnlocked, challengeRhythmView, validateChallengeLevel };
