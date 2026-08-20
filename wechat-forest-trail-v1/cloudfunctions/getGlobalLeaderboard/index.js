const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async (event) => {
  const scopeKey = String(event.scopeKey || ""); if (!scopeKey) throw new Error("scope-required");
  const [result, total] = await Promise.all([
    db.collection("forest_trail_results").where({ scopeKey }).orderBy("score", "desc").limit(100).field({ openid: false }).get(),
    db.collection("forest_trail_results").where({ scopeKey }).count(),
  ]);
  return { items: result.data.map((item, index) => ({ rank: index + 1, score: item.score, levelId: item.levelId, elapsedMs: item.elapsedMs, moves: item.moves, solved: item.solved, remainingMs: item.remainingMs, clockTier: item.clockTier })), total: total.total };
};
