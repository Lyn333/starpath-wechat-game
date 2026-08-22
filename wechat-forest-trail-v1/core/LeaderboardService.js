const CLOUD_ENV = "forest-trail-d6grbvm3o2ab75f2b";
const FRIEND_SCORE_KEY = "forest_trail_rank_score_v1";
const CLOCK_FRIEND_SCORE_KEY = "forest_trail_clock_rank_score_v1";
const CLOUD_RANKING_ENABLED = true;
const CLOUD_SUBMIT_TIMEOUT_MS = 8000;
const CLOUD_FALLBACK_TIMEOUT_MS = 4000;

function platform() { return typeof wx === "undefined" ? null : wx; }
function secondsScore(result) { return Math.max(1, Math.round(100000000 - Math.min(result.elapsedMs || 0, 99999999) - Math.min(result.moves || 0, 9999) * 100)); }
function clockScore(result) { return Math.max(1, Math.floor(result.solved || 0) * 1000000 + Math.min(999999, Math.floor((result.remainingMs || 0) / 1000))); }
function standardScopeKey(level) { return level.sourceKind === "daily" ? `daily:${new Date().toISOString().slice(0, 10)}` : `season:${level.gridSize}:${level.difficulty}`; }
function withTimeout(promise, timeoutMs) { let timer; return Promise.race([Promise.resolve(promise), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("cloud-call-timeout")), timeoutMs); })]).finally(() => clearTimeout(timer)); }

class LeaderboardService {
  constructor({ cloudEnabled = CLOUD_RANKING_ENABLED, cloudSubmitTimeoutMs = CLOUD_SUBMIT_TIMEOUT_MS, cloudFallbackTimeoutMs = CLOUD_FALLBACK_TIMEOUT_MS } = {}) {
    this.cloudEnabled = cloudEnabled;
    this.cloudSubmitTimeoutMs = cloudSubmitTimeoutMs;
    this.cloudFallbackTimeoutMs = cloudFallbackTimeoutMs;
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
  async submitGlobal(title, payload, scopeKey, score) {
    const api = platform();
    if (!this.cloudReady || !api?.cloud?.callFunction) return false;
    this.rankings.global = { state: "loading", text: `正在同步${title}…` };
    try { return this.applyRank(await withTimeout(api.cloud.callFunction({ name: "submitGameResult", data: payload }), this.cloudSubmitTimeoutMs), title); }
    catch (_) { return this.readGlobalFallback(title, scopeKey, score, payload.levelId); }
  }
  async readGlobalFallback(title, scopeKey, score, levelId) {
    const api = platform();
    try {
      const response = await withTimeout(api.cloud.callFunction({ name: "getGlobalLeaderboard", data: { scopeKey } }), this.cloudFallbackTimeoutMs);
      const items = response?.result?.items || []; const total = response?.result?.total;
      const matching = items.find((item) => item.levelId === levelId && Number(item.score) === Number(score));
      if (!matching || !Number.isInteger(total)) throw new Error("rank-fallback-miss");
      const rank = items.filter((item) => Number(item.score) > Number(score)).length + 1;
      this.rankings.global = { state: "ready", text: `${title}第 ${rank} 名 / ${total} 人` }; return true;
    } catch (_) { this.rankings.global = { state: "service-required", text: `${title}同步超时，稍后重试` }; return false; }
  }
  async submitCompletion(level, result) {
    const api = platform(); const score = secondsScore(result);
    // 好友榜依赖关系链隐私授权；其失败或平台回调悬挂不得阻塞总榜同步与后续游戏操作。
    this.writeFriendScore(FRIEND_SCORE_KEY, score, "正在同步好友排名…", "好友榜已同步，点击查看");
    return this.submitGlobal("总榜", { levelId: level.id, gridSize: level.gridSize, difficulty: level.difficulty, sourceKind: level.sourceKind, elapsedMs: result.elapsedMs, moves: result.moves, score }, standardScopeKey(level), score);
  }
  async submitClockResult(tier, result) {
    const api = platform(); const score = clockScore(result);
    // 时间挑战同样应在好友榜未授权时保持可结束、可重开并继续提交真实总榜。
    this.writeFriendScore(CLOCK_FRIEND_SCORE_KEY, score, "正在同步时间挑战好友榜…", "时间挑战好友榜已同步，点击查看");
    return this.submitGlobal("时间挑战总榜", { levelId: `clock-${tier.id}`, gridSize: tier.gridSize, difficulty: tier.difficulty, sourceKind: "clock", clockTier: tier.id, solved: result.solved, remainingMs: result.remainingMs }, `clock:${tier.id}`, score);
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
