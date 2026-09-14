/**
 * 评分、连击与星级：纯函数，不依赖 wx / Canvas。
 *
 *   基础分       = 棋盘格数 × 难度倍率
 *   速度奖励     = max(0, 目标时长 − 实际用时) 秒 × 2
 *   无错误奖励   = +100
 *   连击奖励     = 10 × 本局最高连击
 *   连胜奖励     = 50 / 100 / 200（本次会话内连续通关，封顶 200）
 *   提示 −30/次，撤回 −10/次，错误 −5/次；总分下限 10。
 */

const DIFFICULTY_MULTIPLIER = { easy: 10, medium: 15, hard: 20, expert: 25 };
const PAR_SECONDS_PER_CELL = { easy: 2.5, medium: 3, hard: 3.5, expert: 4 };
const SPEED_BONUS_PER_SECOND = 2;
const NO_MISTAKE_BONUS = 100;
const COMBO_BONUS_PER_STEP = 10;
const WIN_STREAK_BONUSES = [50, 100, 200];
const HINT_PENALTY = 30;
const UNDO_PENALTY = 10;
const ERROR_PENALTY = 5;
const MIN_SCORE = 10;
const ONE_STAR_UNDO_THRESHOLD = 3;
const ONE_STAR_HINT_THRESHOLD = 2;

function cellCount(level) { return Math.max(1, (level?.rows || 0) * (level?.cols || 0)); }
function multiplierFor(difficulty) { return DIFFICULTY_MULTIPLIER[difficulty] || DIFFICULTY_MULTIPLIER.medium; }
function nonNegativeInt(value) { return Math.max(0, Math.floor(Number(value) || 0)); }

function baseScore(level) { return Math.round(cellCount(level) * multiplierFor(level?.difficulty)); }

function parTimeMs(level) {
  const perCell = PAR_SECONDS_PER_CELL[level?.difficulty] || PAR_SECONDS_PER_CELL.medium;
  return Math.round(cellCount(level) * perCell * 1000);
}

function winStreakBonus(streak) {
  const count = nonNegativeInt(streak);
  if (count < 2) return 0;
  return WIN_STREAK_BONUSES[Math.min(WIN_STREAK_BONUSES.length, count - 1) - 1];
}

function normalizeStats(stats = {}) {
  return {
    elapsedMs: nonNegativeInt(stats.elapsedMs),
    errors: nonNegativeInt(stats.errors),
    undos: nonNegativeInt(stats.undos),
    hints: nonNegativeInt(stats.hints),
    maxCombo: nonNegativeInt(stats.maxCombo),
    winStreak: nonNegativeInt(stats.winStreak),
  };
}

function scoreBreakdown(level, rawStats) {
  const stats = normalizeStats(rawStats);
  const par = parTimeMs(level);
  const base = baseScore(level);
  const speedBonus = Math.round(Math.max(0, par - stats.elapsedMs) / 1000 * SPEED_BONUS_PER_SECOND);
  const noMistakeBonus = stats.errors === 0 ? NO_MISTAKE_BONUS : 0;
  const comboBonus = COMBO_BONUS_PER_STEP * stats.maxCombo;
  const streakBonus = winStreakBonus(stats.winStreak);
  const hintPenalty = HINT_PENALTY * stats.hints;
  const undoPenalty = UNDO_PENALTY * stats.undos;
  const errorPenalty = ERROR_PENALTY * stats.errors;
  const total = Math.max(MIN_SCORE, base + speedBonus + noMistakeBonus + comboBonus + streakBonus - hintPenalty - undoPenalty - errorPenalty);
  return { base, speedBonus, noMistakeBonus, comboBonus, streakBonus, hintPenalty, undoPenalty, errorPenalty, total, parTimeMs: par };
}

function starsFor(level, rawStats) {
  const stats = normalizeStats(rawStats);
  if (stats.hints >= ONE_STAR_HINT_THRESHOLD || stats.undos >= ONE_STAR_UNDO_THRESHOLD) return 1;
  if (stats.errors === 0 && stats.hints === 0 && stats.elapsedMs <= parTimeMs(level)) return 3;
  return 2;
}

function completionLabels(level, rawStats) {
  const stats = normalizeStats(rawStats);
  const stars = starsFor(level, stats);
  const labels = [];
  if (stars === 3) labels.push("Perfect");
  else if (stats.errors === 0) labels.push("No Mistake");
  else labels.push("Great");
  if (stats.elapsedMs <= parTimeMs(level) && stars !== 3) labels.push("Fast");
  if (stats.maxCombo >= 5) labels.push(`Combo ×${stats.maxCombo}`);
  return labels;
}

// 进行中的实时分：按已覆盖格数折算基础分，加连击、减惩罚；不含速度与无错误奖励（结算时才知道）。
function liveScore(level, rawStats, coveredCells) {
  const stats = normalizeStats(rawStats);
  const progress = Math.min(1, nonNegativeInt(coveredCells) / cellCount(level));
  const partialBase = Math.round(baseScore(level) * progress);
  const value = partialBase + COMBO_BONUS_PER_STEP * stats.maxCombo - HINT_PENALTY * stats.hints - UNDO_PENALTY * stats.undos - ERROR_PENALTY * stats.errors;
  return Math.max(0, value);
}

function comboLabel(combo) { return combo >= 2 ? `Combo ×${combo}` : null; }

module.exports = {
  COMBO_BONUS_PER_STEP, DIFFICULTY_MULTIPLIER, ERROR_PENALTY, HINT_PENALTY, MIN_SCORE, NO_MISTAKE_BONUS,
  ONE_STAR_HINT_THRESHOLD, ONE_STAR_UNDO_THRESHOLD, PAR_SECONDS_PER_CELL, SPEED_BONUS_PER_SECOND, UNDO_PENALTY, WIN_STREAK_BONUSES,
  baseScore, comboLabel, completionLabels, liveScore, normalizeStats, parTimeMs, scoreBreakdown, starsFor, winStreakBonus,
};
