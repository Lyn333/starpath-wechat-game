/**
 * 微信小游戏入口。将整个 wechat-forest-trail-core 目录复制到小游戏项目根目录后即可使用。
 * 若工程已有 game.js，请把此文件的初始化逻辑合并进去，而不是重复调用 wx.createCanvas()。
 */

const { TrailEngine } = require("./core/TrailEngine");
const { TrailRenderer } = require("./core/TrailRenderer");
const { TouchController } = require("./core/TouchController");
const { mossGrove6x6 } = require("./levels/mossGrove6x6");

const canvas = wx.createCanvas();
const engine = new TrailEngine(mossGrove6x6);
const renderer = new TrailRenderer(canvas, engine.level);
const controller = new TouchController(engine, renderer);

engine.subscribe((snapshot) => renderer.render(snapshot));

wx.onTouchStart((event) => controller.handleStart(event));
wx.onTouchMove((event) => controller.handleMove(event));
wx.onTouchEnd(() => controller.handleEnd());
wx.onTouchCancel(() => controller.handleEnd());

if (wx.onWindowResize) {
  wx.onWindowResize(() => {
    renderer.resize();
    renderer.render(engine.getSnapshot());
  });
}

module.exports = { engine, renderer, controller };
