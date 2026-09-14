const assert = require("assert");
const {
  LIGHT_SHAFT_COUNT, MAX_RAINDROPS, MIST_BAND_COUNT, RAIN_WINDOW, WEATHER_CYCLE_MS,
  createWeatherScene, cyclePosition, drawWeatherBackdrop, drawWeatherMist, drawWeatherRain,
  lightIntensityAt, mistIntensityAt, rainIntensityAt,
} = require("../core/effects/AmbientWeather");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { ForestTrailMiniGame, WEATHER_ACTIVE_MS, WEATHER_IDLE_MS } = require("../core/GameFlow");
const { MemoryStorageAdapter } = require("../core/platform/StorageAdapter");
const { ProgressStore } = require("../core/ProgressStore");
const { CLOCK_TIERS } = require("../core/modes/ModeCatalog");

const W = 390, H = 844;
const at = (position) => Math.round(position * WEATHER_CYCLE_MS);

// 1. 周期位置与三段强度曲线：晴光 → 微雨 → 雨后薄雾，边界处平滑无跳变。
assert.strictEqual(cyclePosition(0), 0);
assert.ok(Math.abs(cyclePosition(WEATHER_CYCLE_MS * 2.25) - .25) < 1e-9);
assert.ok(Math.abs(cyclePosition(-WEATHER_CYCLE_MS * .25) - .75) < 1e-9, "负时间戳也应回绕到合法区间");
assert.strictEqual(rainIntensityAt(.1), 0);
assert.strictEqual(rainIntensityAt((RAIN_WINDOW.start + RAIN_WINDOW.end) / 2), 1);
assert.strictEqual(rainIntensityAt(.95), 0);
assert.strictEqual(mistIntensityAt(.2), 0);
assert.ok(mistIntensityAt(RAIN_WINDOW.end + .06) > .5, "雨停后薄雾应升起");
assert.ok(mistIntensityAt(.99) < .1, "周期尾部薄雾应散去");
for (let position = 0; position < 1; position += .002) {
  const delta = Math.abs(rainIntensityAt(position + .002) - rainIntensityAt(position));
  assert.ok(delta < .1, `雨强度在 ${position.toFixed(3)} 处跳变 ${delta}`);
}
assert.ok(lightIntensityAt(.1, 0) > lightIntensityAt((RAIN_WINDOW.start + RAIN_WINDOW.end) / 2, 0), "雨中光柱应弱于晴天");

// 2. 场景生成是纯函数：同一时间戳结果完全一致；雨滴数量随强度缩放且始终有上限。
const sunny = createWeatherScene(at(.1), W, H), rainy = createWeatherScene(at(.6), W, H), clearing = createWeatherScene(at(RAIN_WINDOW.end + .06), W, H);
assert.deepStrictEqual(createWeatherScene(at(.6), W, H), rainy);
assert.strictEqual(sunny.phase, "sunlit"); assert.strictEqual(rainy.phase, "rain"); assert.strictEqual(clearing.phase, "clearing");
assert.strictEqual(sunny.raindrops.length, 0);
assert.strictEqual(rainy.raindrops.length, MAX_RAINDROPS);
assert.strictEqual(sunny.lightShafts.length, LIGHT_SHAFT_COUNT);
assert.strictEqual(rainy.mistBands.length, MIST_BAND_COUNT);
assert.strictEqual(sunny.skyDim, 0); assert.ok(rainy.skyDim > 0 && rainy.skyDim < .3, "雨天压暗应克制，不影响可读性");
for (const drop of rainy.raindrops) {
  assert.ok(drop.x >= -20 && drop.x <= W + 20, `雨滴 x 越界：${drop.x}`);
  assert.ok(drop.y >= -30 && drop.y <= H + 30, `雨滴 y 越界：${drop.y}`);
  assert.ok(drop.alpha > 0 && drop.alpha <= .45, "雨滴应保持半透明，不遮挡棋盘");
}
// 雨滴随时间下落：同一雨滴在 100ms 后 y 应增大（除回绕）。
const later = createWeatherScene(at(.6) + 100, W, H);
const falling = rainy.raindrops.filter((drop, index) => later.raindrops[index].y > drop.y).length;
assert.ok(falling > MAX_RAINDROPS * .8, `大部分雨滴应在下落，实际 ${falling}/${MAX_RAINDROPS}`);
// 光柱随时间摇曳：两个时刻的顶点 x 不同。
assert.notStrictEqual(sunny.lightShafts[0].topX, createWeatherScene(at(.1) + 3000, W, H).lightShafts[0].topX);

// 3. 绘制函数对精简 Canvas 兼容：无 createLinearGradient 也能画；返回实际绘制雨滴数。
const calls = [];
const bare = new Proxy({}, { get: (target, property) => (property in target ? target[property] : (...args) => { calls.push([property, args]); return undefined; }), set: (target, property, value) => { target[property] = value; return true; } });
drawWeatherBackdrop(bare, sunny); drawWeatherMist(bare, clearing);
assert.strictEqual(drawWeatherRain(bare, rainy), MAX_RAINDROPS);
assert.strictEqual(drawWeatherRain(bare, sunny), 0);
assert.strictEqual(drawWeatherRain(bare, null), 0);
assert.ok(calls.some(([name]) => name === "fill"), "光柱应被填充绘制");
assert.ok(calls.filter(([name]) => name === "stroke").length >= MAX_RAINDROPS, "每颗雨滴一次 stroke");

// 4. 渲染器集成：天气层出现在 UI 之下（先 fillRect 天空、后画雨、再画弹窗），并可整体关闭。
global.wx = { getWindowInfo: () => ({ windowWidth: W, windowHeight: H, pixelRatio: 1 }) };
const ops = [];
const target = {
  setTransform() {}, clearRect() { ops.push("clearRect"); }, fillRect() { ops.push("fillRect"); }, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() { ops.push(this.strokeStyle === "rgba(226,242,255,1)" ? "rain" : "stroke"); }, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {},
  fillText(value) { ops.push(`text:${value}`); }, measureText(value) { return { width: String(value).length * 12 }; },
  createLinearGradient() { return { addColorStop() {} }; },
};
const context = new Proxy(target, { get: (object, property) => (property in object ? object[property] : () => {}), set: (object, property, value) => { object[property] = value; return true; } });
const renderer = new SingleBoardRenderer({ getContext: () => context });
const solution = [];
for (let row = 0; row < 6; row += 1) for (let index = 0; index < 6; index += 1) solution.push({ row, col: row % 2 ? 5 - index : index });
renderer.setLevel({ id: "w", gridSize: "6x6", difficulty: "easy", rows: 6, cols: 6, walls: [], solution, waypoints: [{ number: 1, cell: solution[0] }, { number: 2, cell: solution.at(-1) }] });
const snapshot = { status: "idle", path: [], moves: 0, nextWaypoint: 1, message: "" };
const baseView = { mode: "standard", progressiveLevel: 1, difficulty: "easy", difficultyLabel: "简单", gridSize: "6x6", sound: true, points: 0, time: "0:00", clockActive: false, clockSetupVisible: false, clockEnded: false, clockTiers: Object.values(CLOCK_TIERS), rankings: { friend: { text: "" }, global: { text: "" } }, completion: { best: { elapsedMs: 0 }, streak: 0 } };
renderer.render(snapshot, { ...baseView, weatherNow: at(.6) });
assert.strictEqual(renderer.weatherScene.phase, "rain");
assert.strictEqual(renderer.lastRainDrawn, MAX_RAINDROPS);
assert.strictEqual(ops.filter((op) => op === "rain").length, MAX_RAINDROPS);
const firstTitle = ops.findIndex((op) => op === "text:棋盘颜色"), firstRain = ops.indexOf("rain");
assert.ok(firstRain > firstTitle, "雨滴应画在界面按钮之上");
ops.length = 0;
renderer.render(snapshot, { ...baseView, weatherNow: at(.6), infoVisible: true });
const lastRain = ops.lastIndexOf("rain"), infoTitleIndex = ops.indexOf("text:玩法说明");
assert.ok(lastRain < infoTitleIndex, "弹窗应盖在雨层之上");
renderer.render(snapshot, { ...baseView, weatherEnabled: false, weatherNow: at(.6) });
assert.strictEqual(renderer.weatherScene, null);
assert.strictEqual(renderer.lastRainDrawn, 0);
delete global.wx;

// 5. GameFlow 集成：默认开启并按阶段调度帧率；destroy 清理定时器；可通过 services 关闭。
class RendererMock { constructor() { this.controls = {}; this.weatherScene = null; this.renders = 0; } setLevel() {} render(snapshot, view) { this.renders += 1; this.lastView = view; } hit() { return false; } resize() {} toCell() { return null; } startCompletionFireworks() {} clearCompletionFireworks() {} }
class SoundMock { startBackgroundMusic() {} setEnabled() {} tap() {} coin() {} undo() {} reset() {} complete() {} playCompletionCelebration() {} destroy() {} }
class LeaderboardMock { initialize() { return Promise.resolve(true); } status() { return { friend: { text: "" }, global: { text: "" } }; } submitCompletion() { return Promise.resolve(true); } submitClockResult() { return Promise.resolve(true); } openFriendBoard() { return true; } }
const game = new ForestTrailMiniGame({}, [], { progress: new ProgressStore({ storage: new MemoryStorageAdapter() }), renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock() });
assert.strictEqual(game.view().weatherEnabled, true);
assert.ok(game.weatherTimer, "默认应启动天气帧调度");
assert.strictEqual(game.weatherFrameDelay(), WEATHER_IDLE_MS, "渲染器尚无场景时用低频");
game.renderer.weatherScene = { rain: 1, mist: 0 };
assert.strictEqual(game.weatherFrameDelay(), WEATHER_ACTIVE_MS);
game.renderer.weatherScene = { rain: 0, mist: 0 };
assert.strictEqual(game.weatherFrameDelay(), WEATHER_IDLE_MS);
game.weatherPaused = true; game.scheduleWeatherFrame();
assert.strictEqual(game.weatherTimer, null, "后台时不应调度天气帧");
game.weatherPaused = false; game.scheduleWeatherFrame();
assert.ok(game.weatherTimer);
game.destroy();
assert.strictEqual(game.weatherTimer, null);
const quiet = new ForestTrailMiniGame({}, [], { weatherEnabled: false, progress: new ProgressStore({ storage: new MemoryStorageAdapter() }), renderer: new RendererMock(), sound: new SoundMock(), leaderboard: new LeaderboardMock() });
assert.strictEqual(quiet.view().weatherEnabled, false);
assert.strictEqual(quiet.weatherTimer, null);
quiet.destroy();

console.log("PASS ambient-weather");
