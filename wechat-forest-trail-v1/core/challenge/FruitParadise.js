/**
 * 水果乐园：10 秒记忆 + 全棋盘相邻盲连。
 *
 * 与太空旅行的点选连线不同，本主题沿用数字连线的四方向相邻拖动，
 * 但数字换成水果检查点：先记 10 秒，再隐藏全部水果与数字，从 1 连到 10 并覆盖全盘。
 * 首发 5 关共用 6×6 蛇形哈密顿路径，检查点坐标按策划案固定；每局只随机分配水果图案。
 */

const { createSeededRandom, shuffle } = require("../puzzle/SeededRandom");

const FRUIT_PREVIEW_MS = 10000;
const FRUIT_HIDE_MS = 350;
const FRUIT_REPLAY_MS = 3000;
const FRUIT_COUNT = 10;
const FRUIT_GRID = "6x6";

const FRUIT_BASE_SCORE = 500;
const FRUIT_COVER_BONUS = 300;
const FRUIT_ZERO_ERROR_BONUS = 200;
const FRUIT_ZERO_UNDO_BONUS = 100;
const FRUIT_TIME_BONUS_PER_SECOND = 2;
const FRUIT_MEMORY_BONUS = 150;

const FRUIT_ICONS = {
  苹果: "🍎", 香蕉: "🍌", 西瓜: "🍉", 草莓: "🍓", 葡萄: "🍇", 橙子: "🍊",
  菠萝: "🍍", 桃子: "🍑", 蓝莓: "🫐", 猕猴桃: "🥝", 樱桃: "🍒", 柠檬: "🍋", 椰子: "🥥",
};

const FRUIT_POOL = ["苹果", "香蕉", "草莓", "葡萄", "橙子", "西瓜", "蓝莓", "桃子", "猕猴桃", "菠萝"];

function rc(r, c) { return { row: r - 1, col: c - 1 }; }
function cellKey(cell) { return `${cell.row}-${cell.col}`; }
function copyCell(cell) { return { row: cell.row, col: cell.col }; }
function sameCell(a, b) { return a.row === b.row && a.col === b.col; }
function isAdjacent(a, b) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1; }

function snakePath(rows = 6, cols = 6) {
  const path = [];
  for (let row = 0; row < rows; row += 1) {
    if (row % 2 === 0) for (let col = 0; col < cols; col += 1) path.push({ row, col });
    else for (let col = cols - 1; col >= 0; col -= 1) path.push({ row, col });
  }
  return path;
}

function pathIndexMap(path) {
  const map = new Map();
  path.forEach((cell, index) => map.set(cellKey(cell), index));
  return map;
}

function turnsBetween(path, fromIndex, toIndex) {
  let turns = 0;
  for (let index = fromIndex + 1; index < toIndex; index += 1) {
    const prev = path[index - 1], cur = path[index], next = path[index + 1];
    if (!next) break;
    const d1 = { row: cur.row - prev.row, col: cur.col - prev.col };
    const d2 = { row: next.row - cur.row, col: next.col - cur.col };
    if (d1.row !== d2.row || d1.col !== d2.col) turns += 1;
  }
  return turns;
}

function isInterior(cell, rows, cols) {
  return cell.row > 0 && cell.row < rows - 1 && cell.col > 0 && cell.col < cols - 1;
}

function buildFruitLevel({ id, index, title, difficulty, connectMs, undoLimit, errorMode, threeStarMs, threeStarMaxUndos, perfectMs, seq }) {
  const [rows, cols] = FRUIT_GRID.split("x").map(Number);
  const solution = snakePath(rows, cols);
  const waypoints = seq.map(([name, r, c], position) => ({
    number: position + 1, cell: rc(r, c), icon: FRUIT_ICONS[name] || "●", name,
  }));
  return {
    id, theme: "fruit", index, title, gridSize: FRUIT_GRID, rows, cols, difficulty,
    sourceKind: "challenge", playStyle: "fruit-cover", requireFullCoverage: true,
    walls: [], blockedCells: [], categories: [],
    waypoints, solution, previewMs: FRUIT_PREVIEW_MS, hidden: true, memoryMode: "hidden",
    showTargetName: false, connectMs, targetMs: connectMs, undoLimit, errorMode,
    threeStarMs, threeStarMaxUndos, perfectMs, fruitCount: FRUIT_COUNT,
  };
}

const FRUIT_LEVELS = [
  buildFruitLevel({
    id: "challenge-fruit-1", index: 1, title: "苹果果园", difficulty: "easy",
    connectMs: 90000, undoLimit: 3, errorMode: "practice-step",
    threeStarMs: 60000, threeStarMaxUndos: 0, perfectMs: 45000,
    seq: [["苹果", 1, 1], ["香蕉", 1, 6], ["草莓", 2, 6], ["葡萄", 2, 1], ["橙子", 3, 1], ["西瓜", 3, 6], ["蓝莓", 4, 6], ["桃子", 4, 1], ["猕猴桃", 5, 1], ["菠萝", 5, 6]],
  }),
  buildFruitLevel({
    id: "challenge-fruit-2", index: 2, title: "水果小径", difficulty: "easy",
    connectMs: 100000, undoLimit: 2, errorMode: "practice-step",
    threeStarMs: 70000, threeStarMaxUndos: 1, perfectMs: 55000,
    seq: [["草莓", 1, 1], ["西瓜", 2, 4], ["苹果", 3, 2], ["猕猴桃", 3, 6], ["香蕉", 4, 4], ["蓝莓", 5, 1], ["葡萄", 5, 4], ["桃子", 6, 6], ["橙子", 6, 3], ["菠萝", 6, 1]],
  }),
  buildFruitLevel({
    id: "challenge-fruit-3", index: 3, title: "迷雾果林", difficulty: "medium",
    connectMs: 110000, undoLimit: 2, errorMode: "practice-fruit",
    threeStarMs: 80000, threeStarMaxUndos: 1, perfectMs: 65000,
    seq: [["菠萝", 1, 1], ["蓝莓", 1, 4], ["香蕉", 2, 2], ["草莓", 3, 4], ["葡萄", 4, 6], ["西瓜", 4, 2], ["苹果", 5, 2], ["猕猴桃", 5, 5], ["橙子", 6, 4], ["桃子", 6, 1]],
  }),
  buildFruitLevel({
    id: "challenge-fruit-4", index: 4, title: "彩虹果园", difficulty: "hard",
    connectMs: 120000, undoLimit: 1, errorMode: "challenge-fail",
    threeStarMs: 90000, threeStarMaxUndos: 0, perfectMs: 75000,
    seq: [["蓝莓", 1, 1], ["橙子", 1, 5], ["草莓", 2, 5], ["猕猴桃", 3, 1], ["菠萝", 3, 5], ["香蕉", 4, 3], ["西瓜", 5, 1], ["葡萄", 5, 4], ["苹果", 6, 5], ["桃子", 6, 1]],
  }),
  buildFruitLevel({
    id: "challenge-fruit-5", index: 5, title: "丰收秘境", difficulty: "hard",
    connectMs: 140000, undoLimit: 0, errorMode: "challenge-fail",
    threeStarMs: 105000, threeStarMaxUndos: 0, perfectMs: 90000,
    seq: [["苹果", 1, 1], ["西瓜", 2, 6], ["蓝莓", 2, 3], ["香蕉", 3, 3], ["草莓", 3, 6], ["猕猴桃", 4, 4], ["葡萄", 4, 1], ["橙子", 5, 3], ["桃子", 6, 6], ["菠萝", 6, 1]],
  }),
];

function dealFruitIcons(level, seed) {
  if (!level || level.playStyle !== "fruit-cover") return level;
  const random = createSeededRandom(seed || `${level.id}:${Date.now()}`);
  const names = shuffle(FRUIT_POOL, random).slice(0, FRUIT_COUNT);
  const waypoints = level.waypoints.map((waypoint, index) => ({
    ...waypoint,
    name: names[index],
    icon: FRUIT_ICONS[names[index]],
  }));
  return { ...level, waypoints, fruitDealSeed: String(seed || "") };
}

function selectFruitNodes(path, random, count = FRUIT_COUNT) {
  const total = path.length;
  const minGap = 2;
  const minEnds = Math.max(minGap, Math.floor(total / 4));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const picks = [];
    picks.push(0);
    while (picks.length < count) {
      const next = 1 + Math.floor(random() * (total - 1));
      if (picks.includes(next)) continue;
      picks.push(next);
    }
    picks.sort((a, b) => a - b);
    if (picks[count - 1] - picks[0] < minEnds) continue;
    let gapOk = true;
    for (let index = 1; index < picks.length; index += 1) if (picks[index] - picks[index - 1] < minGap) gapOk = false;
    if (!gapOk) continue;
    const nodes = picks.map((index) => path[index]);
    const left = nodes.filter((cell) => cell.col < 3).length;
    const right = nodes.filter((cell) => cell.col >= 3).length;
    if (left === 0 || right === 0) continue;
    if (nodes.filter((cell) => isInterior(cell, 6, 6)).length < 3) continue;
    let turnCount = 0;
    for (let index = 1; index < picks.length; index += 1) turnCount += turnsBetween(path, picks[index - 1], picks[index]) > 0 ? 1 : 0;
    if (turnCount < 2) continue;
    return picks;
  }
  return [0, 3, 7, 11, 16, 20, 24, 28, 32, 35];
}

function generateFruitLayout({ rows = 6, cols = 6, seed = "fruit" } = {}) {
  const path = snakePath(rows, cols);
  const random = createSeededRandom(seed);
  const indexes = selectFruitNodes(path, random);
  const names = shuffle(FRUIT_POOL, random).slice(0, FRUIT_COUNT);
  const waypoints = indexes.map((index, position) => ({
    number: position + 1, cell: copyCell(path[index]), name: names[position], icon: FRUIT_ICONS[names[position]],
  }));
  return { path, waypoints };
}

function validateFruitCoverLayout(level) {
  if (level.playStyle !== "fruit-cover") throw new Error(`${level.id}：不是水果全覆盖关。`);
  if (level.gridSize !== FRUIT_GRID || level.rows !== 6 || level.cols !== 6) throw new Error(`${level.id}：首发必须是 6×6。`);
  if (level.waypoints.length !== FRUIT_COUNT) throw new Error(`${level.id}：必须有 10 个水果。`);
  if (level.previewMs !== FRUIT_PREVIEW_MS) throw new Error(`${level.id}：记忆时间必须是 10 秒。`);
  if (level.hidden !== true || level.memoryMode !== "hidden") throw new Error(`${level.id}：弹窗结束后必须全部隐藏。`);
  if (level.showTargetName) throw new Error(`${level.id}：连线阶段不得显示目标名称。`);
  if (!["practice-step", "practice-fruit", "challenge-fail"].includes(level.errorMode)) throw new Error(`${level.id}：未知错误处理。`);
  const solution = level.solution || [];
  if (solution.length !== level.rows * level.cols) throw new Error(`${level.id}：标准解必须覆盖全盘。`);
  for (let index = 1; index < solution.length; index += 1) {
    if (!isAdjacent(solution[index - 1], solution[index])) throw new Error(`${level.id}：标准解第 ${index} 步不相邻。`);
  }
  const seenPath = new Set();
  solution.forEach((cell) => {
    const key = cellKey(cell);
    if (seenPath.has(key)) throw new Error(`${level.id}：标准解重复经过格子。`);
    seenPath.add(key);
  });
  const indexOf = pathIndexMap(solution);
  let previous = -1;
  const seenFruit = new Set();
  level.waypoints.forEach((waypoint, index) => {
    if (waypoint.number !== index + 1) throw new Error(`${level.id}：水果编号必须从 1 连续递增。`);
    const { row, col } = waypoint.cell;
    if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) throw new Error(`${level.id}：水果 ${waypoint.name} 越界。`);
    const key = cellKey(waypoint.cell);
    if (seenFruit.has(key)) throw new Error(`${level.id}：水果重叠。`);
    seenFruit.add(key);
    const at = indexOf.get(key);
    if (at == null) throw new Error(`${level.id}：水果 ${waypoint.number} 不在完整路径上。`);
    if (at <= previous) throw new Error(`${level.id}：水果 ${waypoint.number} 在路径上逆序。`);
    if (previous >= 0 && at - previous < 2 && index > 0) {
      // 相邻编号允许贴边转折（第 1 关蛇形），只禁止落到同一格。
    }
    previous = at;
    if (!waypoint.icon || !waypoint.name) throw new Error(`${level.id}：水果缺少图案。`);
  });
  const start = level.waypoints[0].cell;
  if (start.row !== solution[0].row || start.col !== solution[0].col) throw new Error(`${level.id}：起点必须是水果 1。`);
  return true;
}

function remainingConnectMs(level, elapsedMs) {
  return Math.max(0, (level.connectMs || 0) - Math.max(0, Number(elapsedMs) || 0));
}

function fruitGrade(level, stats = {}) {
  const covered = Math.max(0, Number(stats.covered) || 0);
  const total = level.rows * level.cols;
  const errors = Math.max(0, Number(stats.errors) || 0);
  const undos = Math.max(0, Number(stats.undos) || 0);
  const elapsedMs = Math.max(0, Number(stats.elapsedMs) || 0);
  const remaining = remainingConnectMs(level, elapsedMs);
  if (covered < total || stats.failed) return "失败";
  if (errors === 0 && undos === 0 && remaining >= Math.ceil((level.connectMs || 0) * 0.3)) return "S";
  if (errors === 0 && undos <= 1) return "A";
  if (errors <= 2) return "B";
  return "C";
}

function fruitStars(level, stats = {}) {
  const covered = Math.max(0, Number(stats.covered) || 0);
  const total = level.rows * level.cols;
  const errors = Math.max(0, Number(stats.errors) || 0);
  const undos = Math.max(0, Number(stats.undos) || 0);
  const elapsedMs = Math.max(0, Number(stats.elapsedMs) || 0);
  if (covered < total || stats.failed) return 0;
  const perfect = errors === 0 && undos === 0 && elapsedMs <= (level.perfectMs || 0);
  const three = errors === 0 && undos <= (level.threeStarMaxUndos || 0) && elapsedMs <= (level.threeStarMs || 0);
  if (perfect || three) return 3;
  if (errors === 0 && undos <= 1) return 2;
  if (errors <= 2) return 2;
  return 1;
}

function isFruitPerfect(level, stats = {}) {
  return fruitStars(level, stats) === 3
    && Math.max(0, Number(stats.errors) || 0) === 0
    && Math.max(0, Number(stats.undos) || 0) === 0
    && Math.max(0, Number(stats.elapsedMs) || 0) <= (level.perfectMs || 0)
    && Math.max(0, Number(stats.covered) || 0) === level.rows * level.cols;
}

function fruitScoreBreakdown(level, stats = {}) {
  const covered = Math.max(0, Number(stats.covered) || 0);
  const total = level.rows * level.cols;
  const fullCover = covered >= total && !stats.failed;
  const errors = Math.max(0, Number(stats.errors) || 0);
  const undos = Math.max(0, Number(stats.undos) || 0);
  const remainingSeconds = Math.ceil(remainingConnectMs(level, stats.elapsedMs) / 1000);
  const base = fullCover ? FRUIT_BASE_SCORE : Math.round(FRUIT_BASE_SCORE * covered / total);
  const coverBonus = fullCover ? FRUIT_COVER_BONUS : 0;
  const noMistakeBonus = fullCover && errors === 0 ? FRUIT_ZERO_ERROR_BONUS : 0;
  const noUndoBonus = fullCover && undos === 0 ? FRUIT_ZERO_UNDO_BONUS : 0;
  const speedBonus = fullCover ? remainingSeconds * FRUIT_TIME_BONUS_PER_SECOND : 0;
  const memoryBonus = fullCover ? FRUIT_MEMORY_BONUS : 0;
  const totalScore = base + coverBonus + noMistakeBonus + noUndoBonus + speedBonus + memoryBonus;
  return {
    base, coverBonus, noMistakeBonus, noUndoBonus, speedBonus, memoryBonus,
    total: totalScore, parTimeMs: level.connectMs,
  };
}

function fruitCompletionLabels(level, stats = {}) {
  const labels = [];
  if (isFruitPerfect(level, stats)) labels.push("完美");
  const grade = fruitGrade(level, stats);
  if (grade !== "失败") labels.push(grade);
  if (Math.max(0, Number(stats.errors) || 0) === 0 && grade !== "失败") labels.push("零错误");
  return labels;
}

const FRUIT_TUTORIAL_STEPS = [
  "先记住 10 秒弹窗里的水果、数字和位置。",
  "水果和数字会全部消失。",
  "从水果 1 的位置开始拖动。",
  "只能上下左右移动。",
  "不能斜走、不能跨格、不能重复经过格子。",
  "必须覆盖所有棋盘格。",
  "到达水果 10 还不代表立即完成，必须走完剩余格子。",
  "游戏过程中不显示下一个水果提示。",
];

module.exports = {
  FRUIT_BASE_SCORE, FRUIT_COVER_BONUS, FRUIT_COUNT, FRUIT_GRID, FRUIT_HIDE_MS, FRUIT_ICONS, FRUIT_LEVELS,
  FRUIT_MEMORY_BONUS, FRUIT_POOL, FRUIT_PREVIEW_MS, FRUIT_REPLAY_MS, FRUIT_TUTORIAL_STEPS,
  FRUIT_TIME_BONUS_PER_SECOND, FRUIT_ZERO_ERROR_BONUS, FRUIT_ZERO_UNDO_BONUS,
  cellKey, copyCell, dealFruitIcons, fruitCompletionLabels, fruitGrade, fruitScoreBreakdown, fruitStars,
  generateFruitLayout, isAdjacent, isFruitPerfect, remainingConnectMs, sameCell, snakePath, validateFruitCoverLayout,
};
