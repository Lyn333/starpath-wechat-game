const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const RESULTS = "forest_trail_results";
const CLOCK_TIERS = new Set(["easy", "medium", "hard", "expert"]);

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !event.levelId) throw new Error("invalid-score-payload");
  const isClock = event.sourceKind === "clock";
  let payload;
  if (isClock) {
    const solved = Number(event.solved); const remainingMs = Number(event.remainingMs); const clockTier = String(event.clockTier || "");
    if (!CLOCK_TIERS.has(clockTier) || !Number.isInteger(solved) || solved < 0 || solved > 100000 || !Number.isInteger(remainingMs) || remainingMs < 0 || remainingMs > 999999) throw new Error("invalid-clock-payload");
    const score = solved * 1000000 + Math.floor(remainingMs / 1000);
    payload = { openid, scopeKey: `clock:${clockTier}`, levelId: String(event.levelId), gridSize: String(event.gridSize || ""), difficulty: String(event.difficulty || ""), sourceKind: "clock", clockTier, solved, remainingMs, score, updatedAt: db.serverDate() };
  } else {
    const elapsedMs = Number(event.elapsedMs); const moves = Number(event.moves); const score = Number(event.score);
    if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 99999999 || !Number.isInteger(moves) || moves < 1 || moves > 100000 || !Number.isInteger(score) || score < 1) throw new Error("invalid-score-payload");
    const scopeKey = event.sourceKind === "daily" ? `daily:${new Date().toISOString().slice(0, 10)}` : `season:${event.gridSize}:${event.difficulty}`;
    payload = { openid, scopeKey, levelId: String(event.levelId), gridSize: String(event.gridSize || ""), difficulty: String(event.difficulty || ""), elapsedMs, moves, score, updatedAt: db.serverDate() };
  }
  const existing = await db.collection(RESULTS).where({ openid, scopeKey: payload.scopeKey }).limit(1).get();
  if (existing.data.length) { if (payload.score > Number(existing.data[0].score || 0)) await db.collection(RESULTS).doc(existing.data[0]._id).update({ data: payload }); }
  else await db.collection(RESULTS).add({ data: payload });
  const [higher, total] = await Promise.all([
    db.collection(RESULTS).where({ scopeKey: payload.scopeKey, score: _.gt(payload.score) }).count(),
    db.collection(RESULTS).where({ scopeKey: payload.scopeKey }).count(),
  ]);
  return { rank: higher.total + 1, total: total.total, scopeKey: payload.scopeKey, score: payload.score };
};
