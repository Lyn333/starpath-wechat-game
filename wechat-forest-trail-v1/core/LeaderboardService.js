const CLOUD_ENV = "forest-trail-d2g9yvxci3e68e058";
const FRIEND_SCORE_KEY = "forest_trail_rank_score_v1";
const CLOCK_FRIEND_SCORE_KEY = "forest_trail_clock_rank_score_v1";
const CLOUD_RANKING_ENABLED = true;

function platform() { return typeof wx === "undefined" ? null : wx; }
function secondsScore(result) { return Math.max(1, Math.round(100000000 - Math.min(result.elapsedMs || 0, 99999999) - Math.min(result.moves || 0, 9999) * 100)); }
function clockScore(result) { return Math.max(1, Math.floor(result.solved || 0) * 1000000 + Math.min(999999, Math.floor((result.remainingMs || 0) / 1000))); }

class LeaderboardService {
  constructor({ cloudEnabled = CLOUD_RANKING_ENABLED } = {}) {
    this.cloudEnabled = cloudEnabled;
    this.cloudReady = false;
    this.rankings = { friend: { state: "authorization-required", text: "好友排名待微信授权" }, global: { state: "service-required", text: "总榜排名待云函数同步" } };
  }
  status() { return this.rankings; }
  async initialize() {
    const api = platform();
    if (!this.cloudEnabled) { this.rankings.global = { state: "service-required", text: "总榜待云服务开通" }; return false; }
    if (!api?.cloud?.init) return false;
    try { await Promise.resolve(api.cloud.init({ env: CLOUD_ENV, traceUser: true })); this.cloudReady = true; this.rankings.global = { state: "ready", text: "总榜将在通关后同步" }; return true; }
    catch (_) { this.rankings.global = { state: "service-required", text: "总榜云服务暂不可用" }; return false; }
  }
  async writeFriendScore(key, score, loadingText, readyText) {
    const api = platform();
    if (!api?.setUserCloudStorage) return false;
    this.rankings.friend = { state: "loading", text: loadingText };
    try { await api.setUserCloudStorage({ KVDataList: [{ key, value: String(score) }] }); this.rankings.friend = { state: "ready", text: readyText }; return true; }
    catch (_) { this.rankings.friend = { state: "authorization-required", text: "好友排名待微信授权" }; return false; }
  }
  async submitCompletion(level, result) {
    const api = platform(); const score = secondsScore(result);
    await this.writeFriendScore(FRIEND_SCORE_KEY, score, "正在同步好友排名…", "好友榜已同步，点击查看");
    if (!this.cloudReady || !api?.cloud?.callFunction) return false;
    this.rankings.global = { state: "loading", text: "正在同步总榜…" };
    try {
      const response = await api.cloud.callFunction({ name: "submitGameResult", data: { levelId: level.id, gridSize: level.gridSize, difficulty: level.difficulty, sourceKind: level.sourceKind, elapsedMs: result.elapsedMs, moves: result.moves, score } });
      return this.applyRank(response, "总榜");
    } catch (_) { this.rankings.global = { state: "service-required", text: "总榜同步失败，稍后重试" }; return false; }
  }
  async submitClockResult(tier, result) {
    const api = platform(); const score = clockScore(result);
    await this.writeFriendScore(CLOCK_FRIEND_SCORE_KEY, score, "正在同步时间挑战好友榜…", "时间挑战好友榜已同步，点击查看");
    if (!this.cloudReady || !api?.cloud?.callFunction) return false;
    this.rankings.global = { state: "loading", text: "正在同步时间挑战总榜…" };
    try {
      const response = await api.cloud.callFunction({ name: "submitGameResult", data: { levelId: `clock-${tier.id}`, gridSize: tier.gridSize, difficulty: tier.difficulty, sourceKind: "clock", clockTier: tier.id, solved: result.solved, remainingMs: result.remainingMs } });
      return this.applyRank(response, "时间挑战总榜");
    } catch (_) { this.rankings.global = { state: "service-required", text: "时间挑战总榜同步失败，稍后重试" }; return false; }
  }
  applyRank(response, title) {
    const rank = response?.result?.rank, total = response?.result?.total;
    this.rankings.global = Number.isInteger(rank) && Number.isInteger(total) ? { state: "ready", text: `${title}第 ${rank} 名 / ${total} 人` } : { state: "service-required", text: `${title}等待服务返回` };
    return this.rankings.global.state === "ready";
  }
  openFriendBoard({ clock = false } = {}) {
    const api = platform(); if (!api?.getOpenDataContext) return false;
    try { api.getOpenDataContext().postMessage({ type: "SHOW_FRIEND_RANK", key: clock ? CLOCK_FRIEND_SCORE_KEY : FRIEND_SCORE_KEY, title: clock ? "时间挑战好友榜" : "好友榜" }); return true; } catch (_) { return false; }
  }
}

module.exports = { CLOUD_ENV, CLOUD_RANKING_ENABLED, FRIEND_SCORE_KEY, CLOCK_FRIEND_SCORE_KEY, LeaderboardService, clockScore };
