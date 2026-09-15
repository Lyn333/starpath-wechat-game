/**
 * 徽章图鉴：首发 27 枚（原 24 + 关卡挑战 3），只开放铜牌 / 银牌两级，数据结构预留金 / 钻。
 *
 * 每枚徽章：
 *   id / name / category / shape / hint（未解锁时的方向提示）
 *   tiers: [{ tier, target, describe }]  — 累计类按次数升级；一次性徽章只有一档
 *   progress(stats, ctx) → number         — 当前累计值；与 target 比较决定等级
 *   一次性条件写在 progress 里返回 0/1，即“发生过一次”
 *
 * ctx 是刚结束的这一局的上下文（见 AchievementTracker.buildContext）；stats 是长期累计统计。
 * 记忆类徽章依赖 ctx.memoryMode。关卡挑战第 3–5 关以 hidden 记忆模式计入；淡影 / 闪现仍待独立玩法。
 */

const TIERS = ["bronze", "silver", "gold", "diamond"];
const TIER_LABELS = { bronze: "铜牌", silver: "银牌", gold: "金牌", diamond: "钻石牌" };
const TIER_COLORS = { bronze: "#B8794A", silver: "#DCE7EE", gold: "#FFD15A", diamond: "#9D83FF" };
const LAUNCH_MAX_TIER = "silver";

const CATEGORIES = {
  starter: { label: "入门", shape: "circle", color: "#56C7EA" },
  speed: { label: "速度", shape: "hexagon", color: "#FFD35A" },
  accuracy: { label: "准确", shape: "shield", color: "#32B85A" },
  memory: { label: "记忆", shape: "eye", color: "#27B6C8" },
  streak: { label: "连胜", shape: "flame", color: "#F06B68" },
  daily: { label: "每日", shape: "calendar", color: "#9B7CFF" },
  challenge: { label: "关卡", shape: "hexagon", color: "#E36A3E" },
  ultimate: { label: "终极", shape: "starburst", color: "#9D83FF" },
};

const sizeIndex = (gridSize) => Number(String(gridSize || "").split("x")[0]) || 0;
const once = (condition) => (condition ? 1 : 0);
const single = (describe) => [{ tier: "bronze", target: 1, describe }];
const ladder = (bronze, silver, describe) => [
  { tier: "bronze", target: bronze, describe: describe(bronze) },
  { tier: "silver", target: silver, describe: describe(silver) },
];

const BADGES = [
  // —— 入门与基础 ——
  { id: "first-link", name: "初次连线", category: "starter", icon: "1→2", hint: "完成第一局游戏",
    tiers: single("完成第一局游戏"), progress: (stats) => once(stats.completed >= 1) },
  { id: "digit-departure", name: "数字启程", category: "starter", icon: "6", hint: "完成 6×6 棋盘",
    tiers: single("完成一局 6×6 棋盘"), progress: (stats) => once((stats.completedBySize["6x6"] || 0) >= 1) },
  { id: "first-star", name: "第一颗星", category: "starter", icon: "★", hint: "首次获得三星评价",
    tiers: single("首次获得三星评价"), progress: (stats) => once(stats.threeStarClears >= 1) },
  { id: "memory-start", name: "开始记忆", category: "memory", icon: "◉", hint: "首次完成隐藏数字模式",
    tiers: single("首次完成隐藏数字模式"), progress: (stats) => once(stats.memoryClears >= 1) },
  { id: "flawless-stroke", name: "一笔不错", category: "accuracy", icon: "✓", hint: "完成一局且零错误",
    tiers: ladder(1, 5, (n) => `零错误完成 ${n} 局`), progress: (stats) => stats.zeroErrorClears },
  { id: "perfect-board", name: "完美棋盘", category: "accuracy", icon: "◈", hint: "三星且零错误、零撤回",
    tiers: ladder(1, 5, (n) => `三星评价且零错误、零撤回 ${n} 局`), progress: (stats) => stats.perfectClears },
  // —— 速度与准确 ——
  { id: "quick-hands", name: "快手连线", category: "speed", icon: "⚡", hint: "30 秒内完成 6×6",
    tiers: ladder(1, 5, (n) => `30 秒内完成 6×6 ${n} 局`), progress: (stats) => stats.fast6x6Under30 },
  { id: "lightning-digit", name: "闪电数字", category: "speed", icon: "⚡7", hint: "15 秒内完成 6×6",
    tiers: ladder(1, 3, (n) => `15 秒内完成 6×6 ${n} 局`), progress: (stats) => stats.fast6x6Under15 },
  { id: "unbroken-chain", name: "无误连线", category: "accuracy", icon: "∞", hint: "连续正确连接 20 个数字",
    tiers: ladder(1, 5, (n) => `单局内连续正确连接 20 个数字，达成 ${n} 次`), progress: (stats) => stats.combo20Clears },
  { id: "no-undo", name: "撤回绝缘体", category: "accuracy", icon: "↛", hint: "连续 3 局不使用撤回",
    tiers: ladder(3, 10, (n) => `连续 ${n} 局不使用撤回`), progress: (stats) => stats.bestNoUndoRun },
  { id: "calm-finish", name: "冷静到底", category: "accuracy", icon: "◎", hint: "最后 5 个数字全部一次完成",
    tiers: ladder(1, 5, (n) => `最后 5 个数字全部一次完成，达成 ${n} 局`), progress: (stats) => stats.calmFinishClears },
  { id: "speed-master", name: "速度大师", category: "speed", icon: "»", hint: "6×6、8×8、10×10 都达到目标时间",
    tiers: single("在 6×6、8×8、10×10 三种尺寸均在目标时间内完成"), progress: (stats) => once(["6x6", "8x8", "10x10"].every((size) => (stats.underParBySize[size] || 0) >= 1)) },
  // —— 记忆挑战（关卡挑战隐藏关以 memoryMode: "hidden" 计入；淡影 / 闪现仍锁定）——
  { id: "faint-walker", name: "淡影行者", category: "memory", icon: "◌", hint: "半透明数字模式完成 5 局",
    tiers: ladder(5, 15, (n) => `半透明数字模式完成 ${n} 局`), progress: (stats) => stats.memoryClearsByMode.faded || 0 },
  { id: "photographic", name: "过目不忘", category: "memory", icon: "◉7", hint: "完全隐藏模式零错误完成",
    tiers: ladder(1, 5, (n) => `完全隐藏模式零错误完成 ${n} 局`), progress: (stats) => stats.hiddenZeroErrorClears },
  { id: "flash-catcher", name: "闪现捕手", category: "memory", icon: "◉⚡", hint: "连续正确找到 10 个闪现数字",
    tiers: ladder(1, 5, (n) => `闪现模式连续正确找到 10 个数字，达成 ${n} 次`), progress: (stats) => stats.flashCombo10Clears },
  { id: "short-memory", name: "短忆高手", category: "memory", icon: "3s", hint: "3 秒预览后完成 6×6",
    tiers: ladder(1, 5, (n) => `3 秒预览后完成 6×6 ${n} 局`), progress: (stats) => stats.shortPreview6x6Clears },
  { id: "blind-expert", name: "盲连专家", category: "memory", icon: "—", hint: "8×8 完全隐藏、零提示完成",
    tiers: ladder(1, 3, (n) => `8×8 完全隐藏、零提示完成 ${n} 局`), progress: (stats) => stats.blind8x8Clears },
  { id: "memory-stamina", name: "记忆耐力", category: "memory", icon: "∞◉", hint: "连续完成 5 局隐藏模式",
    tiers: ladder(5, 10, (n) => `连续完成 ${n} 局隐藏模式`), progress: (stats) => stats.bestMemoryRun },
  // —— 持续与每日 ——
  { id: "steady-focus", name: "连续专注", category: "streak", icon: "🔥", hint: "连续 3 局完成",
    tiers: ladder(3, 10, (n) => `连续完成 ${n} 局`), progress: (stats) => stats.longestWinStreak },
  { id: "memory-streak", name: "记忆连胜", category: "streak", icon: "🔥◉", hint: "连续 7 局完成隐藏模式",
    tiers: ladder(7, 15, (n) => `连续完成 ${n} 局隐藏模式`), progress: (stats) => stats.bestMemoryRun },
  { id: "week-unforgotten", name: "一周不忘", category: "streak", icon: "7d", hint: "连续 7 天完成至少 1 局",
    tiers: ladder(7, 14, (n) => `连续 ${n} 天每天完成至少 1 局`), progress: (stats) => stats.longestDayStreak },
  { id: "daily-checkin", name: "今日签到", category: "daily", icon: "📅", hint: "完成 1 次每日挑战",
    tiers: ladder(1, 7, (n) => `完成 ${n} 次每日挑战（每天最多计 1 次）`), progress: (stats) => stats.dailyClears },
  { id: "daily-three-star", name: "每日三星", category: "daily", icon: "📅★", hint: "每日挑战获得三星 7 次",
    tiers: ladder(7, 20, (n) => `每日挑战获得三星 ${n} 次`), progress: (stats) => stats.dailyThreeStars },
  { id: "fruit-harvest", name: "果园丰收", category: "challenge", icon: "🍎", hint: "完成水果乐园全部 5 关",
    tiers: ladder(5, 15, (n) => n === 5 ? "完成水果乐园全部 5 关" : "水果乐园累计 15 星"), progress: (stats) => (stats.fruitThemeStars || 0) >= 15 ? 15 : (stats.fruitThemeClears || 0) },
  { id: "space-voyage", name: "星云航程", category: "challenge", icon: "🚀", hint: "完成太空旅行全部 5 关",
    tiers: ladder(5, 15, (n) => n === 5 ? "完成太空旅行全部 5 关" : "太空旅行累计 15 星"), progress: (stats) => (stats.spaceThemeStars || 0) >= 15 ? 15 : (stats.spaceThemeClears || 0) },
  { id: "challenge-collector", name: "主题收藏家", category: "challenge", icon: "🎯", hint: "完成两套主题共 10 关",
    tiers: ladder(10, 30, (n) => n === 10 ? "完成全部 10 个主题关卡" : "主题关卡累计 30 星"), progress: (stats) => (stats.challengeStars || 0) >= 30 ? 30 : (stats.challengeClears || 0) },
  { id: "ultimate-memory", name: "终极记忆者", category: "ultimate", icon: "✦", hint: "获得全部基础记忆徽章",
    tiers: single("获得全部基础记忆徽章"), progress: (stats, ctx, unlocked) => once(MEMORY_BASE_BADGES.every((id) => unlocked?.[id])) },
];

const MEMORY_BASE_BADGES = ["memory-start", "faint-walker", "photographic", "flash-catcher", "short-memory", "blind-expert", "memory-stamina"];

const TITLES = [
  { id: "digit-novice", name: "数字新手", condition: "完成全部入门徽章", unlocked: (unlocked) => ["first-link", "digit-departure", "first-star"].every((id) => unlocked[id]) },
  { id: "digit-tracker", name: "数字追踪者", condition: "获得 5 枚准确性徽章", unlocked: (unlocked) => BADGES.filter((badge) => badge.category === "accuracy" && unlocked[badge.id]).length >= 5 },
  { id: "lightning-memory", name: "闪电记忆", condition: "获得速度类银牌", unlocked: (unlocked) => BADGES.some((badge) => badge.category === "speed" && unlocked[badge.id]?.tier === "silver") },
  { id: "blind-expert", name: "盲连专家", condition: "获得“盲连专家”徽章", unlocked: (unlocked) => Boolean(unlocked["blind-expert"]) },
  { id: "daily-challenger", name: "每日挑战者", condition: "今日签到达到银牌", unlocked: (unlocked) => unlocked["daily-checkin"]?.tier === "silver" },
  { id: "theme-master", name: "主题大师", condition: "完成两套主题关卡", unlocked: (unlocked) => Boolean(unlocked["fruit-harvest"] && unlocked["space-voyage"]) },
  { id: "focus-master", name: "专注大师", condition: "一笔不错与完美棋盘均达银牌", unlocked: (unlocked) => unlocked["flawless-stroke"]?.tier === "silver" && unlocked["perfect-board"]?.tier === "silver" },
  { id: "ultimate-linker", name: "终极连线者", condition: "解锁全部首发徽章", unlocked: (unlocked) => BADGES.every((badge) => unlocked[badge.id]) },
];

function tierIndex(tier) { return TIERS.indexOf(tier); }
function badgeById(id) { return BADGES.find((badge) => badge.id === id) || null; }
function tiersAvailable(badge, maxTier = LAUNCH_MAX_TIER) { return badge.tiers.filter((step) => tierIndex(step.tier) <= tierIndex(maxTier)); }

// 由累计值推出当前等级与下一档进度。
function evaluateBadge(badge, stats, ctx = {}, unlocked = {}, maxTier = LAUNCH_MAX_TIER) {
  const value = Math.max(0, Math.floor(Number(badge.progress(stats, ctx, unlocked)) || 0));
  const steps = tiersAvailable(badge, maxTier);
  let achieved = null;
  for (const step of steps) if (value >= step.target) achieved = step;
  const next = steps.find((step) => value < step.target) || null;
  return { id: badge.id, value, tier: achieved?.tier || null, describe: achieved?.describe || null, next: next ? { tier: next.tier, target: next.target, remaining: next.target - value, describe: next.describe } : null };
}

module.exports = { BADGES, CATEGORIES, LAUNCH_MAX_TIER, MEMORY_BASE_BADGES, TIERS, TIER_COLORS, TIER_LABELS, TITLES, badgeById, evaluateBadge, sizeIndex, tierIndex, tiersAvailable };
