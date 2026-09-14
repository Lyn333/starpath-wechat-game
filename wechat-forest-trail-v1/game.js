const { ForestTrailMiniGame } = require("./core/GameFlow");
const { OpeningSequence } = require("./core/OpeningSequence");

const canvas = wx.createCanvas();
let game = null;
let opening = null;

function loadSubpackage(name) {
  if (!wx.loadSubpackage) return Promise.resolve({ name, loaded: true, fallback: true });
  return new Promise((resolve) => {
    wx.loadSubpackage({
      name,
      success: () => resolve({ name, loaded: true, fallback: false }),
      fail: (error) => resolve({ name, loaded: false, fallback: false, error }),
    });
  });
}

function readCatalog() {
  try { return require("./catalog/catalogManifest.js"); }
  catch (error) {
    console.warn("精品题包不可用，将使用 Seed 生成模式继续运行。", error);
    return { LEVEL_BUNDLE_METADATA: { totalLevels: 0, fallback: "seed-generator" }, BUCKET_COUNTS: {}, loadBucket: () => [] };
  }
}

function beginGame(catalog) {
  game = new ForestTrailMiniGame(canvas, [], { catalog });
  const count = Number(catalog?.LEVEL_BUNDLE_METADATA?.totalLevels) || 0;
  console.log(count ? `森林寻径已接入 ${count} 道原创精品关卡，并按规格懒加载与启用 Seed 生成兜底。` : "森林寻径已启用 Seed 生成模式。");
}

async function bootstrap() {
  const audio = await loadSubpackage("audio");
  if (!audio.loaded) console.warn("音频分包加载失败，游戏将继续运行。", audio.error);
  const catalog = await loadSubpackage("catalog");
  if (!catalog.loaded) console.warn("精品题包加载失败，将尝试 Seed 生成兜底。", catalog.error);
  const catalogData = readCatalog();
  opening = new OpeningSequence(canvas, { onComplete: () => { opening = null; beginGame(catalogData); } });
  opening.start();
}

wx.onTouchStart((event) => { if (opening?.active) return opening.skip(); game?.handleStart(event); });
wx.onTouchMove((event) => game?.handleMove(event));
wx.onTouchEnd(() => game?.handleEnd());
wx.onTouchCancel(() => game?.handleEnd());
if (wx.onWindowResize) wx.onWindowResize(() => { opening?.resize(); game?.resize(); });
bootstrap();

module.exports = { bootstrap, loadSubpackage, readCatalog, get game() { return game; }, get opening() { return opening; } };
