/**
 * 有限提示策略：纯函数，负责“还剩几次、下一次是哪种、消耗后剩多少”。
 * 存储由 ProgressStore 负责；这里只做规则。
 *
 * 三级提示按同一局内使用次数递进：
 *   第 1 次  轻提示    高亮下一个数字所在格
 *   第 2 次  路径提示  短暂显示接下来 4 步
 *   第 3 次+ 自动连接  直接走到下一个数字（扣分更多）
 */

const DAILY_FREE_HINTS = 3;
const MAX_STORED_HINTS = 9;
const PERFECT_CLEAR_REWARD = 1;
const PATH_HINT_STEPS = 4;
const HINT_TIERS = ["light", "path", "auto"];
const HINT_TIER_LABELS = { light: "轻提示", path: "路径提示", auto: "自动连接" };

function nonNegativeInt(value) { return Math.max(0, Math.floor(Number(value) || 0)); }

function normalizeHintWallet(value, todayKey) {
  const wallet = value && typeof value === "object" ? value : {};
  const stored = Math.min(MAX_STORED_HINTS, nonNegativeInt(wallet.remaining));
  if (wallet.lastRefillDate === todayKey) return { remaining: stored, lastRefillDate: todayKey };
  // 新的一天：补足到每日免费额度，但不覆盖玩家额外积攒的次数。
  return { remaining: Math.min(MAX_STORED_HINTS, Math.max(stored, DAILY_FREE_HINTS)), lastRefillDate: todayKey };
}

function canUseHint(wallet) { return nonNegativeInt(wallet?.remaining) > 0; }

function consumeHint(wallet) {
  if (!canUseHint(wallet)) return wallet;
  return { ...wallet, remaining: nonNegativeInt(wallet.remaining) - 1 };
}

function rewardHints(wallet, count = PERFECT_CLEAR_REWARD) {
  return { ...wallet, remaining: Math.min(MAX_STORED_HINTS, nonNegativeInt(wallet?.remaining) + nonNegativeInt(count)) };
}

function hintTierFor(usedThisLevel) {
  return HINT_TIERS[Math.min(HINT_TIERS.length - 1, nonNegativeInt(usedThisLevel))];
}

// 返回下一个应经过的数字格，以及从当前路径末端到它的标准解片段。
function planHint(level, path, tier) {
  const solution = level?.solution || [];
  const waypoints = level?.waypoints || [];
  const from = path.length;
  if (!solution.length || from >= solution.length) return null;
  const nextNumber = waypoints.find((waypoint) => !path.some((cell) => cell.row === waypoint.cell.row && cell.col === waypoint.cell.col));
  if (!nextNumber) return null;
  const targetIndex = solution.findIndex((cell) => cell.row === nextNumber.cell.row && cell.col === nextNumber.cell.col);
  const segmentToNumber = targetIndex >= from ? solution.slice(from, targetIndex + 1) : [];
  if (tier === "light") return { tier, nextNumber: nextNumber.number, cells: [nextNumber.cell], message: `提示：下一个数字是 ${nextNumber.number}` };
  if (tier === "path") return { tier, nextNumber: nextNumber.number, cells: solution.slice(from, from + PATH_HINT_STEPS), message: "阳光照亮了接下来几步林径。" };
  return { tier, nextNumber: nextNumber.number, cells: segmentToNumber, autoMoves: segmentToNumber, message: `已自动连到 ${nextNumber.number} 号路标。` };
}

module.exports = {
  DAILY_FREE_HINTS, HINT_TIERS, HINT_TIER_LABELS, MAX_STORED_HINTS, PATH_HINT_STEPS, PERFECT_CLEAR_REWARD,
  canUseHint, consumeHint, hintTierFor, normalizeHintWallet, planHint, rewardHints,
};
