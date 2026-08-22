const assert = require("node:assert/strict");
const fs = require("node:fs");
const { CLOUD_ENV, CLOUD_RANKING_ENABLED, FRIEND_SCORE_KEY, LeaderboardService } = require("../core/LeaderboardService");

const calls = { init: [], storage: [], cloud: [], messages: [] };
global.wx = {
  cloud: {
    init(options) { calls.init.push(options); },
    callFunction: async (options) => { calls.cloud.push(options); return { result: { rank: 7, total: 31 } }; },
  },
  setUserCloudStorage: async (options) => { calls.storage.push(options); },
  getOpenDataContext: () => ({ postMessage: (message) => calls.messages.push(message) }),
};

(async () => {
  assert.equal(CLOUD_ENV, "forest-trail-d6grbvm3o2ab75f2b", "排行榜必须指向正式小游戏新建云环境");
  assert.equal(CLOUD_RANKING_ENABLED, true, "正式小游戏云环境已开通时应启用排行榜特性");
  const service = new LeaderboardService({ cloudEnabled: true });
  assert.equal(await service.initialize(), true, "云开发环境应初始化成功");
  assert.deepEqual(calls.init[0], { env: CLOUD_ENV, traceUser: true }, "初始化必须使用已提供云环境，不携带密钥");
  await service.submitCompletion({ id: "level-1", gridSize: "6x6", difficulty: "easy", sourceKind: "catalog" }, { elapsedMs: 12500, moves: 36 });
  assert.equal(calls.storage[0].KVDataList[0].key, FRIEND_SCORE_KEY, "好友榜必须写入规定的托管数据键");
  assert.equal(calls.cloud[0].name, "submitGameResult", "总榜必须通过云函数提交");
  assert.equal(Object.hasOwn(calls.cloud[0].data, "openid"), false, "客户端不得上传或伪造OpenID");
  assert.equal(service.status().global.text, "总榜第 7 名 / 31 人", "总榜只显示云函数返回的真实名次");
  let resolveFriendWrite;
  global.wx.setUserCloudStorage = () => new Promise((resolve) => { resolveFriendWrite = resolve; });
  const nonBlockingService = new LeaderboardService({ cloudEnabled: true });
  await nonBlockingService.initialize();
  const cloudCallsBeforePendingFriendWrite = calls.cloud.length;
  await nonBlockingService.submitCompletion({ id: "level-pending-friend", gridSize: "6x6", difficulty: "easy", sourceKind: "catalog" }, { elapsedMs: 8300, moves: 30 });
  assert.equal(calls.cloud.length, cloudCallsBeforePendingFriendWrite + 1, "好友榜存储回调悬挂时，总榜提交不得被阻塞");
  resolveFriendWrite();
  assert.equal(service.openFriendBoard(), true, "好友榜应向开放数据域发送消息");
  assert.deepEqual(calls.messages[0], { type: "SHOW_FRIEND_RANK", key: FRIEND_SCORE_KEY, title: "好友榜" }, "开放数据域消息协议应固定好友榜键");
  const gameConfig = JSON.parse(fs.readFileSync(require.resolve("../game.json"), "utf8"));
  assert.equal(gameConfig.openDataContext, "open-data", "小游戏配置应声明开放数据域目录");
  const openData = fs.readFileSync(require.resolve("../open-data/index.js"), "utf8");
  assert.match(openData, /getFriendCloudStorage/, "开放数据域必须通过微信关系链接口读取好友成绩");
  delete global.wx;
  const unavailable = new LeaderboardService({ cloudEnabled: true });
  assert.equal(await unavailable.initialize(), false, "无微信云能力时应保持服务不可用状态");
  assert.equal(await unavailable.submitCompletion({ id: "offline" }, { elapsedMs: 1, moves: 1 }), false, "无服务时不得伪造提交成功");
  assert.equal(unavailable.status().friend.state, "authorization-required", "无授权时好友榜必须保持待授权状态");
  assert.equal(unavailable.status().global.state, "service-required", "无服务时总榜必须保持待同步状态");
  assert.equal(unavailable.openFriendBoard(), false, "无开放数据域时不得声称好友榜已打开");
  global.wx = { cloud: { init: () => { throw new Error("invalid scope"); } } };
  const disabled = new LeaderboardService({ cloudEnabled: false });
  assert.equal(await disabled.initialize(), false, "云排行榜特性关闭时不应调用云初始化");
  assert.equal(disabled.status().global.text, "总榜待云服务开通", "未开通云服务时应显示明确降级状态");
  console.log("云开发排行榜与开放数据域协议校验通过");
})().catch((error) => { console.error(error); process.exitCode = 1; });
