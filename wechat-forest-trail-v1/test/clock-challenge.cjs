const assert = require("node:assert/strict");
const storage = new Map(); const cloudCalls = []; const storageCalls = []; const messages = [];
global.wx = { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), cloud: { init() {}, callFunction: async (options) => { cloudCalls.push(options); return { result: { rank: 2, total: 9 } }; } }, setUserCloudStorage: async (options) => storageCalls.push(options), getOpenDataContext: () => ({ postMessage: (message) => messages.push(message) }) };
const { CLOCK_TIERS, createClockLevel } = require("../core/DailyChallenge");
const { ProgressStore } = require("../core/ProgressStore");
const { CLOCK_FRIEND_SCORE_KEY, LeaderboardService, clockScore } = require("../core/LeaderboardService");
const fs = require("node:fs");

(async () => {
  assert.deepEqual(Object.keys(CLOCK_TIERS), ["easy", "medium", "hard", "expert"], "时间挑战应提供四档");
  assert.deepEqual(CLOCK_TIERS.expert, { id: "expert", label: "专家", gridSize: "12x12", difficulty: "hard" }, "专家档应锁定12x12困难题库");
  const clockLevel = createClockLevel("medium", 3); assert.equal(clockLevel.sourceKind, "clock"); assert.equal(clockLevel.gridSize, "8x8"); assert.equal(clockLevel.clockTier, "medium");
  const progress = new ProgressStore(); const first = progress.recordClockResult("easy", { solved: 2, remainingMs: 8000 }); assert.equal(first.best.solved, 2); const lower = progress.recordClockResult("easy", { solved: 2, remainingMs: 1000 }); assert.equal(lower.best.remainingMs, 8000, "同局数时应保留剩余时间更多的成绩"); const higher = progress.recordClockResult("easy", { solved: 3, remainingMs: 0 }); assert.equal(higher.best.solved, 3, "完成局数更多时应刷新最佳成绩");
  const service = new LeaderboardService({ cloudEnabled: true }); await service.initialize(); await service.submitClockResult(CLOCK_TIERS.hard, { solved: 4, remainingMs: 13000 }); assert.equal(storageCalls.at(-1).KVDataList[0].key, CLOCK_FRIEND_SCORE_KEY, "时间挑战应使用独立好友榜键"); assert.equal(storageCalls.at(-1).KVDataList[0].value, String(clockScore({ solved: 4, remainingMs: 13000 }))); assert.equal(cloudCalls.at(-1).data.sourceKind, "clock"); assert.equal(cloudCalls.at(-1).data.clockTier, "hard"); assert.equal(Object.hasOwn(cloudCalls.at(-1).data, "openid"), false, "时间挑战不得传递OpenID"); assert.equal(service.status().global.text, "时间挑战总榜第 2 名 / 9 人"); service.openFriendBoard({ clock: true }); assert.deepEqual(messages.at(-1), { type: "SHOW_FRIEND_RANK", key: CLOCK_FRIEND_SCORE_KEY, title: "时间挑战好友榜" });
  const submitFunction = fs.readFileSync(require.resolve("../cloudfunctions/submitGameResult/index.js"), "utf8"); const readFunction = fs.readFileSync(require.resolve("../cloudfunctions/getGlobalLeaderboard/index.js"), "utf8"); assert.match(submitFunction, /clockTier/); assert.match(submitFunction, /solved/); assert.match(submitFunction, /remainingMs/); assert.match(readFunction, /solved: item\.solved/); assert.match(readFunction, /remainingMs: item\.remainingMs/);
  console.log("Beat the Clock四档、最佳成绩与排行榜协议校验通过");
})().catch((error) => { console.error(error); process.exitCode = 1; });
