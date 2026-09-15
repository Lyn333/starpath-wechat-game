const assert = require("assert");
const { SingleBoardRenderer } = require("../core/SingleBoardRenderer");
const { CLOCK_TIERS } = require("../core/modes/ModeCatalog");
const { BOARD_THEMES, DEFAULT_BOARD_THEME_ID } = require("../core/themes/BoardThemes");

assert.strictEqual(DEFAULT_BOARD_THEME_ID, "tai-bai");
assert.strictEqual(BOARD_THEMES.length, 12);
for (const theme of BOARD_THEMES) assert.deepStrictEqual([theme.palette.pathStart, theme.palette.pathMiddle, theme.palette.pathEnd], ["#0E9F57", "#2FE278", "#087F46"]);

global.wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }) };
const text = [], textStyles = [], gradients = [], lineWidths = [], fonts = [];
const target = {
  setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, quadraticCurveTo() {}, rect() {},
  fillText(value, x, y) { text.push(String(value)); textStyles.push({ value: String(value), fill: this.fillStyle, x, y, align: this.textAlign, baseline: this.textBaseline }); },
  measureText(value) { return { width: String(value).length * 12 }; },
  createLinearGradient() { return { addColorStop(position, color) { gradients.push([position, color]); } }; },
};
const context = new Proxy(target, {
  get(object, property) { return property in object ? object[property] : () => {}; },
  set(object, property, value) { object[property] = value; if (property === "lineWidth") lineWidths.push(value); if (property === "font") fonts.push(value); return true; },
});
const renderer = new SingleBoardRenderer({ getContext: () => context });
const solution = [];
for (let row = 0; row < 6; row += 1) for (let index = 0; index < 6; index += 1) solution.push({ row, col: row % 2 ? 5 - index : index });
renderer.setLevel({ id: "render", gridSize: "6x6", difficulty: "easy", rows: 6, cols: 6, walls: [], solution, waypoints: [{ number: 1, cell: solution[0] }, { number: 2, cell: solution.at(-1) }] });
const snapshot = { status: "idle", path: solution.slice(0, 2), moves: 1, nextWaypoint: 2, message: "" };
const view = { mode: "standard", difficulty: "easy", difficultyLabel: "简单", gridSize: "6x6", sound: true, points: 0, time: "0:00", clockActive: false, clockSetupVisible: false, clockEnded: false, challengeSelectVisible: false, clockTiers: Object.values(CLOCK_TIERS), infoVisible: true, themePickerVisible: false, rankings: { friend: { text: "好友榜" }, global: { text: "总榜" } }, completion: { best: { elapsedMs: 0 }, streak: 0 } };
renderer.render(snapshot, view);
assert.ok(renderer.controls.info && renderer.controls.theme && renderer.controls.selectedLevel && renderer.controls.sound && renderer.controls.daily && renderer.controls.challenge && renderer.controls.clock);
assert.ok(!renderer.controls.progressive, "渐进按钮应已移除");
assert.ok(renderer.controls.info.y < renderer.controls.theme.y && renderer.controls.theme.y < renderer.controls.selectedLevel.y);
assert.strictEqual(renderer.controls.info.x, renderer.board.left);
assert.strictEqual(renderer.controls.theme.x, renderer.board.left);
assert.strictEqual(renderer.controls.selectedLevel.x, renderer.board.left);
assert.ok(renderer.controls.info.width < renderer.controls.theme.width && renderer.controls.theme.width < renderer.controls.selectedLevel.width);
assert.ok(renderer.board.top >= 146);
for (const label of ["i", "棋盘颜色", "已选 · 简单 6x6", "音效 开"]) assert.ok(textStyles.some((item) => item.value === label && item.fill === "#171717"));
// 时间与分数：白色，位于状态条（数字 / 错误 / 连击）正上方，以屏幕中线为轴左右对称。
const timerDraw = textStyles.find((item) => item.value === "◷ 0:00"), scoreDraw = textStyles.find((item) => item.value === "Points: 0");
assert.ok(timerDraw && scoreDraw, "应绘制时间与分数");
assert.strictEqual(timerDraw.fill, "#FFFFFF"); assert.strictEqual(scoreDraw.fill, "#FFFFFF");
assert.strictEqual(timerDraw.y, scoreDraw.y, "时间与分数应位于同一行");
const statusStripCenterY = renderer.board.top - 22;
assert.ok(timerDraw.y < statusStripCenterY, "时间与分数应位于状态条正上方");
assert.ok(timerDraw.y > renderer.controls.selectedLevel.y + renderer.controls.selectedLevel.height, "时间与分数应位于顶部控件下方");
assert.strictEqual(timerDraw.baseline, "middle"); assert.strictEqual(scoreDraw.baseline, "middle");
assert.strictEqual(timerDraw.align, "right"); assert.strictEqual(scoreDraw.align, "left");
assert.strictEqual(timerDraw.x + scoreDraw.x, 390, "时间与分数应以屏幕中线对称");
assert.ok(fonts.some((font) => font === "700 22px Microsoft YaHei, sans-serif"));
assert.ok(text.includes("i"));
assert.ok(text.includes("每格只走一次，覆盖全盘并抵达末号通关。"));
assert.ok(!text.includes("每个格子只能经过一次；覆盖整盘并到达最后数字即通关。"));
assert.ok(text.includes("每日挑战"));
assert.ok(text.includes("🎯 关卡挑战"));
assert.deepStrictEqual(gradients.slice(-3), [[0, "#0E9F57"], [0.5, "#2FE278"], [1, "#087F46"]]);
const boardFont = fonts.findLast((font) => /Microsoft YaHei/.test(font) && /px/.test(font));
assert.ok(boardFont);
assert.ok(lineWidths.some((value) => value >= 56 / 3));
renderer.drawClockSetup({ clockTiers: Object.values(CLOCK_TIERS) });
for (const label of ["+10 秒", "+7 秒", "+5 秒", "+3 秒"]) assert.ok(text.includes(label));
renderer.render(snapshot, { ...view, boardTheme: "zhu-sha" });
assert.deepStrictEqual(gradients.slice(-3), [[0, "#0E9F57"], [0.5, "#2FE278"], [1, "#087F46"]]);
renderer.render(snapshot, { ...view, themePickerVisible: true, boardTheme: "zhu-sha" });
assert.strictEqual(renderer.controls.themeOptions.length, 12);
assert.ok(renderer.controls.themeClose);
assert.strictEqual(renderer.controls.themeOptions[0].id, "tai-bai");
assert.ok(renderer.controls.themeOptions[0].x < renderer.controls.themeOptions[1].x);
assert.strictEqual(renderer.controls.themeOptions[0].y, renderer.controls.themeOptions[1].y);
for (const label of ["棋盘颜色", "肽白为默认 · 诗意中国色 · 统一绿色连线", "肽白", "硃砂", "硃磦", "藤黄", "三青", "三绿", "胭脂", "曙红", "赭石", "墨黑", "花青", "酞青蓝"]) assert.ok(text.includes(label), `缺少主题文案：${label}`);
assert.ok(!text.some((value) => value.includes("色值取自")), "选色弹窗不应再显示色卡来源说明");
// 去掉底部说明后，弹窗应紧贴最后一行选项收口，不留大块空白。
const lastThemeOption = renderer.controls.themeOptions.at(-1);
const themeModalTop = renderer.controls.themeClose.y - 12, themeModalBottom = themeModalTop + renderer.lastThemeModalHeight;
assert.strictEqual(themeModalBottom - (lastThemeOption.y + lastThemeOption.height), 14);
for (const [id, fill] of [["tai-bai", "#F8F8F8"], ["zhu-sha", "#C62918"], ["zhu-biao", "#CF420A"], ["teng-huang", "#FFB61E"], ["san-qing", "#20C6E0"], ["san-lv", "#45B9A2"], ["yan-zhi", "#AB1D22"], ["shu-hong", "#C72A17"], ["zhe-shi", "#612405"], ["mo-hei", "#090B0C"], ["hua-qing", "#191A48"], ["tai-qing-lan", "#012772"]]) {
  const theme = BOARD_THEMES.find((item) => item.id === id);
  assert.ok(theme, `缺少主题：${id}`);
  assert.strictEqual(theme.palette.boardFill, fill, `${id} 棋盘底色应与色卡一致`);
}
renderer.render(snapshot, { ...view, infoVisible: true });
assert.ok(renderer.controls.infoClose && renderer.controls.infoDismiss);
for (const label of ["玩法说明", "按 1、2、3、4… 的顺序经过所有数字路标。", "只能上下左右移动；不能斜走，也不能穿过墙体。", "每格只走一次，覆盖全盘并抵达末号通关。", "知道了"]) assert.ok(text.includes(label));
console.log("PASS renderer-modes");
