const CLOUD_ENV = "forest-trail-d2g9yvxci3e68e058";
const FRIEND_SCORE_KEY = "forest_trail_rank_score_v1";
// 管理员已为当前小游戏开通对应云环境；部署云函数与索引后即可提交真实总榜成绩。
const CLOUD_RANKING_ENABLED = true;

function platform() { return typeof wx === "undefined" ? null : wx; }
function secondsScore(result) { return Math.max(1, Math.round(100000000 - Math.min(result.elapsedMs || 0, 99999999) - Math.min(result.moves || 0, 9999) * 100)); }

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
  async submitCompletion(level, result) {
    const api = platform(); const score = secondsScore(result);
    if (api?.setUserCloudStorage) {
      this.rankings.friend = { state: "loading", text: "正在同步好友排名…" };
      try { await api.setUserCloudStorage({ KVDataList: [{ key: FRIEND_SCORE_KEY, value: String(score) }] }); this.rankings.friend = { state: "ready", text: "好友榜已同步，点击查看" }; }
      catch (_) { this.rankings.friend = { state: "authorization-required", text: "好友排名待微信授权" }; }
    }
    if (!this.cloudReady || !api?.cloud?.callFunction) return false;
    this.rankings.global = { state: "loading", text: "正在同步总榜…" };
    try {
      const response = await api.cloud.callFunction({ name: "submitGameResult", data: { levelId: level.id, gridSize: level.gridSize, difficulty: level.difficulty, sourceKind: level.sourceKind, elapsedMs: result.elapsedMs, moves: result.moves, score } });
      const rank = response?.result?.rank, total = response?.result?.total;
      this.rankings.global = Number.isInteger(rank) && Number.isInteger(total) ? { state: "ready", text: `总榜第 ${rank} 名 / ${total} 人` } : { state: "service-required", text: "总榜等待服务返回" };
      return true;
    } catch (_) { this.rankings.global = { state: "service-required", text: "总榜同步失败，稍后重试" }; return false; }
  }
  openFriendBoard() {
    const api = platform(); if (!api?.getOpenDataContext) return false;
    try { api.getOpenDataContext().postMessage({ type: "SHOW_FRIEND_RANK", key: FRIEND_SCORE_KEY, title: "好友榜" }); return true; } catch (_) { return false; }
  }
}

module.exports = { CLOUD_ENV, CLOUD_RANKING_ENABLED, FRIEND_SCORE_KEY, LeaderboardService };
