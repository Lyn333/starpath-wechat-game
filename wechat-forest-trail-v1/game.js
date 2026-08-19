const { ForestTrailMiniGame } = require("./core/GameFlow");

const canvas = wx.createCanvas();
let game = null;

function start() {
  const { LEVELS, LEVEL_BUNDLE_METADATA } = require("./catalog/launchCatalog");
  game = new ForestTrailMiniGame(canvas, LEVELS);
  console.log(`森林寻径微信版已载入 ${LEVEL_BUNDLE_METADATA.totalLevels} 道首发关卡。`);
}

function loadCatalog() {
  if (!wx.loadSubpackage) return start();
  wx.loadSubpackage({ name: "catalog", success: start, fail: (error) => console.error("首发题库加载失败", error) });
}

function loadAudioThenCatalog() {
  if (!wx.loadSubpackage) return loadCatalog();
  wx.loadSubpackage({ name: "audio", success: loadCatalog, fail: (error) => { console.error("背景音乐加载失败，将以静音模式启动", error); loadCatalog(); } });
}

wx.onTouchStart((event) => game?.handleStart(event));
wx.onTouchMove((event) => game?.handleMove(event));
wx.onTouchEnd(() => game?.handleEnd());
wx.onTouchCancel(() => game?.handleEnd());
if (wx.onWindowResize) wx.onWindowResize(() => game?.resize());
loadAudioThenCatalog();

module.exports = { get game() { return game; } };
