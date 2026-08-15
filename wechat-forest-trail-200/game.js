const { ForestPathGame } = require("./core/GameFlow");
const { LEVEL_BUNDLE_METADATA } = require("./data/levelBundle");

const canvas = wx.createCanvas();
const game = new ForestPathGame(canvas);

wx.onTouchStart((event) => game.touchStart(event));
wx.onTouchMove((event) => game.touchMove(event));
wx.onTouchEnd(() => game.touchEnd());
wx.onTouchCancel(() => game.touchEnd());
if (wx.onWindowResize) wx.onWindowResize(() => game.resize());

console.log(`森林寻径已载入 ${LEVEL_BUNDLE_METADATA.totalLevels} 道关卡。`);
module.exports = { game };
