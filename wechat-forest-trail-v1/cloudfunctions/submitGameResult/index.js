const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const RESULTS = "forest_trail_results";

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  const elapsedMs = Number(event.elapsedMs); const moves = Number(event.moves); const score = Number(event.score);
  if (!openid || !event.levelId || !Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 99999999 || !Number.isInteger(moves) || moves < 1 || moves > 100000 || !Number.isInteger(score) || score < 1) throw new Error("invalid-score-payload");
  const scopeKey = event.sourceKind === "daily" ? `daily:${new Date().toISOString().slice(0, 10)}` : `season:${event.gridSize}:${event.difficulty}`;
  const existing = await db.collection(RESULTS).where({ openid, scopeKey }).limit(1).get();
  const payload = { openid, scopeKey, levelId: String(event.levelId), gridSize: String(event.gridSize || ""), difficulty: String(event.difficulty || ""), elapsedMs, moves, score, updatedAt: db.serverDate() };
  if (existing.data.length) { if (score > Number(existing.data[0].score || 0)) await db.collection(RESULTS).doc(existing.data[0]._id).update({ data: payload }); }
  else await db.collection(RESULTS).add({ data: payload });
  const [higher, total] = await Promise.all([
    db.collection(RESULTS).where({ scopeKey, score: _.gt(score) }).count(),
    db.collection(RESULTS).where({ scopeKey }).count(),
  ]);
  return { rank: higher.total + 1, total: total.total, scopeKey };
};
