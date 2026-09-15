function formatDuration(elapsedMs = 0) { const seconds = Math.max(0, Math.ceil(elapsedMs / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function colorAlpha(hex, alpha) {
  const value = String(hex || "").replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((ch) => ch + ch).join("") : value.slice(0, 6);
  const n = parseInt(normalized, 16);
  if (!Number.isFinite(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const { createCompletionEffect, drawFireworks } = require("./effects/CompletionFireworks");
const { createWeatherScene, drawWeatherBackdrop, drawWeatherMist, drawWeatherRain } = require("./effects/AmbientWeather");
const { BOARD_THEMES, getBoardTheme } = require("./themes/BoardThemes");
const { TIER_COLORS, TIER_LABELS } = require("./achievements/BadgeCatalog");
const { FRUIT_TUTORIAL_STEPS } = require("./challenge/FruitParadise");

const FADED_ICON_ALPHA = 0.22;

class SingleBoardRenderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.level = null; this.controls = {}; this.completionFireworks = null; this.resize(); }
  resize() {
    const info = wx.getWindowInfo(); this.width = info.windowWidth; this.height = info.windowHeight; this.dpr = Math.min(info.pixelRatio || 1, 3);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr); if (this.ctx.setTransform) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); else this.ctx.scale(this.dpr, this.dpr);
  }
  setLevel(level) { this.level = level; this.clearCompletionFireworks(); }
  startCompletionFireworks(startedAt = Date.now(), kind = "fireworks") { this.completionFireworks = createCompletionEffect(this.width, this.height, startedAt, kind); return this.completionFireworks; }
  clearCompletionFireworks() { this.completionFireworks = null; }
  drawCompletionFireworks(now = Date.now()) { const active = drawFireworks(this.ctx, this.completionFireworks, now); if (!active) this.completionFireworks = null; return active; }
  layout() {
    // 146 顶部三层控件 + 26 时间/分数行 + 30 状态条 = 202 的棋盘上方预留高度。
    const size = this.level.rows; const headerClearance = 202; const rowHeight = 34; const controlGap = 16; const outerBorder = 8;
    const controlHeight = outerBorder + controlGap + rowHeight * 5 + controlGap * 4; const bottomClearance = 12;
    const maxBoardHeight = this.height - headerClearance - controlHeight - bottomClearance;
    const cell = Math.max(1, Math.floor(Math.min((this.width - 38) / size, maxBoardHeight / size)));
    const width = cell * size; const minTop = headerClearance; const maxTop = Math.max(minTop, this.height - width - controlHeight - bottomClearance);
    const top = Math.max(minTop, Math.min(Math.round((this.height - width) / 2) - 24, maxTop));
    return { cell, width, left: Math.round((this.width - width) / 2), top, controlGap, rowHeight, outerBorder };
  }
  rounded(x, y, width, height, radius, fill, stroke) {
    const c = this.ctx; const r = Math.max(0, Math.min(radius, width / 2, height / 2)); c.beginPath();
    if (!r || !c.quadraticCurveTo) c.rect(x, y, width, height);
    else { c.moveTo(x + r, y); c.lineTo(x + width - r, y); c.quadraticCurveTo(x + width, y, x + width, y + r); c.lineTo(x + width, y + height - r); c.quadraticCurveTo(x + width, y + height, x + width - r, y + height); c.lineTo(x + r, y + height); c.quadraticCurveTo(x, y + height, x, y + height - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); }
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }
  static get MODAL_CONTROL_KEYS() { return ["themeClose", "themeOptions", "infoClose", "infoDismiss", "completion", "close", "next", "leaderboard", "viewBadges", "clockTiers", "clockCancel", "clockRestart", "clockClose", "clockLeaderboard", "friendBoardClose", "badgesClose", "badgeTabs", "badgeTitles", "badgePageNext", "badgePagePrev", "challengeLevels", "challengeClose", "fruitTutorialDismiss", "fruitFailRetry", "fruitFailClose"]; }
  clearModalControls() { for (const key of SingleBoardRenderer.MODAL_CONTROL_KEYS) delete this.controls[key]; }
  render(snapshot, view) {
    const c = this.ctx; c.clearRect(0, 0, this.width, this.height);
    // 天气场景由时间戳确定性生成；关闭时为 null，所有天气绘制自动跳过。
    this.weatherScene = view.weatherEnabled === false ? null : createWeatherScene(view.weatherNow ?? Date.now(), this.width, this.height);
    this.drawSky(); this.drawHeader(snapshot, view); drawWeatherMist(c, this.weatherScene); this.drawBoard(snapshot, view); this.drawControls(snapshot, view);
    this.lastRainDrawn = drawWeatherRain(c, this.weatherScene);
    // 弹窗关闭后必须清掉旧热区，否则隐藏按钮仍可被“隔空”点中。
    this.clearModalControls();
    if (view.friendBoardVisible) this.drawFriendBoard(view); else if (view.badgesVisible) this.drawBadges(view); else if (view.themePickerVisible) this.drawThemePicker(view); else if (view.infoVisible) this.drawInfo(); else if (view.fruitTutorialVisible) this.drawFruitTutorial(view); else if (view.fruitFailedVisible) this.drawFruitFail(snapshot, view); else if (view.challengeSelectVisible) this.drawChallengeSelect(view); else if (view.completionVisible) this.drawCompletion(snapshot, view); else if (view.clockSetupVisible) this.drawClockSetup(view); else if (view.clockEnded) this.drawClockResult(view);
    if (view.fruitMemory?.previewing || view.fruitMemory?.hiding) this.drawFruitMemoryPopup(snapshot, view);
  }
  // 徽章图标：类别决定外形与底色，等级决定外圈；锁定态为灰底轮廓 + 锁。
  drawBadgeIcon(x, y, size, badge) {
    const c = this.ctx, half = size / 2, cx = x + half, cy = y + half, locked = !badge.tier;
    const fill = locked ? "#D8DADF" : badge.color, ring = locked ? "#B9BDC4" : (TIER_COLORS[badge.tier] || "#313238");
    c.save?.(); c.lineWidth = locked ? 2 : 3; c.strokeStyle = ring; c.fillStyle = fill; c.beginPath();
    if (badge.shape === "hexagon") { for (let i = 0; i < 6; i += 1) { const angle = Math.PI / 3 * i - Math.PI / 6, px = cx + half * .92 * Math.cos(angle), py = cy + half * .92 * Math.sin(angle); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); }
    else if (badge.shape === "shield") { c.moveTo(cx, y + 2); c.lineTo(x + size - 3, y + half * .55); c.lineTo(x + size - 6, y + size * .72); c.lineTo(cx, y + size - 2); c.lineTo(x + 6, y + size * .72); c.lineTo(x + 3, y + half * .55); c.closePath(); }
    else if (badge.shape === "flame") { c.moveTo(cx, y + 2); c.quadraticCurveTo?.(x + size, y + half * .9, cx + half * .55, y + size - 4); c.quadraticCurveTo?.(cx, y + size + 2, cx - half * .55, y + size - 4); c.quadraticCurveTo?.(x, y + half * .9, cx, y + 2); c.closePath(); }
    else if (badge.shape === "calendar" || badge.shape === "eye") { const r = badge.shape === "eye" ? half * .5 : 8; const w = size - 4, h = size - 4; c.moveTo(x + 2 + r, y + 2); c.lineTo(x + 2 + w - r, y + 2); c.quadraticCurveTo?.(x + 2 + w, y + 2, x + 2 + w, y + 2 + r); c.lineTo(x + 2 + w, y + 2 + h - r); c.quadraticCurveTo?.(x + 2 + w, y + 2 + h, x + 2 + w - r, y + 2 + h); c.lineTo(x + 2 + r, y + 2 + h); c.quadraticCurveTo?.(x + 2, y + 2 + h, x + 2, y + 2 + h - r); c.lineTo(x + 2, y + 2 + r); c.quadraticCurveTo?.(x + 2, y + 2, x + 2 + r, y + 2); c.closePath(); }
    else if (badge.shape === "starburst") { for (let i = 0; i < 16; i += 1) { const radius = i % 2 ? half * .62 : half * .95, angle = Math.PI / 8 * i - Math.PI / 2; const px = cx + radius * Math.cos(angle), py = cy + radius * Math.sin(angle); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); }
    else c.arc(cx, cy, half * .92, 0, Math.PI * 2);
    c.fill(); c.stroke();
    // 银牌双层外圈。
    if (badge.tier === "silver" || badge.tier === "gold" || badge.tier === "diamond") { c.lineWidth = 1; c.strokeStyle = ring; c.beginPath(); c.arc(cx, cy, half * 1.05, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = locked ? "#8A8F97" : "#FFFFFF"; c.font = `700 ${Math.round(size * (badge.icon.length > 2 ? .28 : .4))}px Microsoft YaHei, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(locked ? "🔒" : badge.icon, cx, cy + 1);
    c.textBaseline = "alphabetic"; c.restore?.();
  }
  drawBadges(view) {
    const collection = view.badgeCollection; if (!collection) return;
    const c = this.ctx, w = Math.min(this.width - 32, 360), h = Math.min(this.height - 120, 620), x = (this.width - w) / 2, y = Math.max(72, (this.height - h) / 2);
    c.fillStyle = "rgba(9,54,86,.72)"; c.fillRect(0, 0, this.width, this.height); this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    this.controls.badgesClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.rounded(this.controls.badgesClose.x, this.controls.badgesClose.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#25313a"; c.font = "700 20px Microsoft YaHei, sans-serif"; c.fillText("成就", this.width / 2, y + 34);
    c.fillStyle = "#69757a"; c.font = "11px Microsoft YaHei, sans-serif"; c.fillText(`已解锁 ${collection.unlockedCount} / ${collection.total}${collection.equippedTitle ? ` · 称号：${collection.equippedTitle}` : ""}`, this.width / 2, y + 54);
    // 页签：徽章图鉴 / 我的称号 / 统计。
    const tabs = [["badges", "徽章图鉴"], ["titles", "我的称号"], ["stats", "统计数据"]], tabW = (w - 40 - 12) / 3, tabY = y + 68;
    this.controls.badgeTabs = tabs.map(([id, label], index) => { const tx = x + 20 + index * (tabW + 6), active = view.badgePage === id; this.rounded(tx, tabY, tabW, 28, 8, active ? "#35a853" : "#fff", active ? "#176b46" : "#d6d0c8"); c.fillStyle = active ? "#fff" : "#303b40"; c.font = "700 12px Microsoft YaHei, sans-serif"; c.textAlign = "center"; c.fillText(label, tx + tabW / 2, tabY + 19); return { id, x: tx, y: tabY, width: tabW, height: 28 }; });
    const contentTop = tabY + 40, contentBottom = y + h - 16;
    if (view.badgePage === "titles") this.drawTitlesPage(collection, x, contentTop, w, contentBottom);
    else if (view.badgePage === "stats") this.drawStatsPage(view, x, contentTop, w, contentBottom);
    else this.drawBadgeGrid(collection, view, x, contentTop, w, contentBottom);
    c.textAlign = "left";
  }
  drawBadgeGrid(collection, view, x, top, w, bottom) {
    const c = this.ctx, columns = 2, cardH = 64, gap = 8, cardW = (w - 40 - gap) / columns, rowsPerPage = Math.max(1, Math.floor((bottom - top - 30) / (cardH + gap))), perPage = rowsPerPage * columns;
    const pages = Math.max(1, Math.ceil(collection.badges.length / perPage)), page = Math.min(pages - 1, view.badgeScroll || 0), items = collection.badges.slice(page * perPage, (page + 1) * perPage);
    items.forEach((badge, index) => {
      const col = index % columns, row = Math.floor(index / columns), cx = x + 20 + col * (cardW + gap), cy = top + row * (cardH + gap);
      this.rounded(cx, cy, cardW, cardH, 10, badge.tier ? "#fff" : "#f4f3f0", badge.tier ? (TIER_COLORS[badge.tier] || "#d6d0c8") : "#e2ded8");
      this.drawBadgeIcon(cx + 8, cy + 10, 44, badge);
      c.fillStyle = badge.tier ? "#2e3a40" : "#8a8f97"; c.font = "700 11px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(badge.name, cx + 60, cy + 20);
      c.fillStyle = "#798287"; c.font = "9px Microsoft YaHei, sans-serif";
      const detail = badge.tier ? `${badge.tierLabel}${badge.next ? ` · 距${TIER_LABELS[badge.next.tier]}还差 ${badge.next.remaining}` : " · 已满级"}` : (badge.count > 0 && badge.next ? `进度 ${badge.count} / ${badge.next.target}` : badge.hint);
      c.fillText(this.truncate(detail, cardW - 68, c.font), cx + 60, cy + 36);
      c.fillText(this.truncate(badge.categoryLabel + " · " + badge.describe, cardW - 68, c.font), cx + 60, cy + 51);
    });
    // 翻页。
    if (pages > 1) {
      const py = bottom - 22; c.textAlign = "center"; c.fillStyle = "#69757a"; c.font = "11px Microsoft YaHei, sans-serif"; c.fillText(`${page + 1} / ${pages}`, this.width / 2, py + 4);
      this.controls.badgePagePrev = { x: x + 20, y: py - 10, width: 60, height: 26 }; this.controls.badgePageNext = { x: x + w - 80, y: py - 10, width: 60, height: 26 };
      this.rounded(this.controls.badgePagePrev.x, this.controls.badgePagePrev.y, 60, 26, 8, page > 0 ? "#fff" : "#f0eeea", "#d6d0c8"); c.fillStyle = page > 0 ? "#303b40" : "#b5b9bf"; c.fillText("上一页", x + 50, py + 7);
      this.rounded(this.controls.badgePageNext.x, this.controls.badgePageNext.y, 60, 26, 8, page < pages - 1 ? "#fff" : "#f0eeea", "#d6d0c8"); c.fillStyle = page < pages - 1 ? "#303b40" : "#b5b9bf"; c.fillText("下一页", x + w - 50, py + 7);
    }
  }
  drawTitlesPage(collection, x, top, w, bottom) {
    const c = this.ctx, rowH = 46, gap = 6;
    this.controls.badgeTitles = collection.titles.map((title, index) => {
      const ty = top + index * (rowH + gap); if (ty + rowH > bottom) return null;
      this.rounded(x + 20, ty, w - 40, rowH, 10, title.unlocked ? "#fff" : "#f4f3f0", title.equipped ? "#35a853" : title.unlocked ? "#d6d0c8" : "#e2ded8");
      c.fillStyle = title.unlocked ? "#2e3a40" : "#8a8f97"; c.font = "700 12px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(title.name, x + 34, ty + 19);
      c.fillStyle = "#798287"; c.font = "9px Microsoft YaHei, sans-serif"; c.fillText(title.condition, x + 34, ty + 35);
      c.textAlign = "right"; c.font = "700 11px Microsoft YaHei, sans-serif"; c.fillStyle = title.equipped ? "#35a853" : title.unlocked ? "#303b40" : "#b5b9bf"; c.fillText(title.equipped ? "已装备" : title.unlocked ? "装备" : "未解锁", x + w - 34, ty + 27);
      return { id: title.id, unlocked: title.unlocked, equipped: title.equipped, x: x + 20, y: ty, width: w - 40, height: rowH };
    }).filter(Boolean);
    c.textAlign = "left";
  }
  drawStatsPage(view, x, top, w, bottom) {
    const c = this.ctx, stats = view.achievementStats || {}, records = view.records || {};
    const rows = [
      ["累计完成", `${stats.completed || 0} 局`], ["三星次数", `${stats.threeStarClears || 0} 次`], ["零错误局数", `${stats.zeroErrorClears || 0} 局`], ["完美棋盘", `${stats.perfectClears || 0} 局`],
      ["最长连胜", `${stats.longestWinStreak || 0} 局`], ["连续天数", `${stats.dayStreak || 0} 天（最长 ${stats.longestDayStreak || 0}）`], ["每日挑战", `${stats.dailyClears || 0} 次`],
      ["最快用时", records.fastestMs ? formatDuration(records.fastestMs) : "—"], ["最少错误", records.fewestErrors === null || records.fewestErrors === undefined ? "—" : `${records.fewestErrors} 次`], ["总星数", `${view.totalStars || 0} ★`],
    ];
    c.font = "12px Microsoft YaHei, sans-serif";
    rows.forEach(([label, value], index) => { const ry = top + 8 + index * 30; if (ry > bottom) return; c.fillStyle = "#69757a"; c.textAlign = "left"; c.fillText(label, x + 30, ry + 6); c.fillStyle = "#25313a"; c.textAlign = "right"; c.font = "700 12px Microsoft YaHei, sans-serif"; c.fillText(value, x + w - 30, ry + 6); c.font = "12px Microsoft YaHei, sans-serif"; if (index < rows.length - 1) { c.strokeStyle = "#ece9e3"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 24, ry + 18); c.lineTo(x + w - 24, ry + 18); c.stroke(); } });
    c.textAlign = "left";
  }
  truncate(text, maxWidth, font) {
    const c = this.ctx; if (!c.measureText) return text; c.font = font;
    if ((c.measureText(text)?.width || 0) <= maxWidth) return text;
    let result = text; while (result.length > 1 && (c.measureText(`${result}…`)?.width || 0) > maxWidth) result = result.slice(0, -1);
    return `${result}…`;
  }
  friendBoardFrame() { const w = Math.min(this.width - 32, 360), h = Math.min(this.height - 160, 560); return { x: (this.width - w) / 2, y: Math.max(92, (this.height - h) / 2), w, h }; }
  friendBoardCanvasSize() { const { w, h } = this.friendBoardFrame(); return { width: Math.round(w * this.dpr), height: Math.round((h - 52) * this.dpr) }; }
  drawFriendBoard(view) {
    const c = this.ctx, { x, y, w, h } = this.friendBoardFrame();
    c.fillStyle = "rgba(9,54,86,.72)"; c.fillRect(0, 0, this.width, this.height); this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    this.controls.friendBoardClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.rounded(this.controls.friendBoardClose.x, this.controls.friendBoardClose.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#25313a"; c.font = "700 18px Microsoft YaHei, sans-serif"; c.fillText(view.friendBoardTitle || "好友榜", this.width / 2, y + 34);
    let drewShared = false;
    if (view.friendBoardCanvas && c.drawImage) { try { c.drawImage(view.friendBoardCanvas, x, y + 52, w, h - 52); drewShared = true; } catch (_) { drewShared = false; } }
    if (!drewShared) { c.fillStyle = "#74706a"; c.font = "13px Microsoft YaHei, sans-serif"; c.fillText("好友成绩加载中…", this.width / 2, y + h / 2); }
    c.textAlign = "left";
  }
  drawSky() {
    const c = this.ctx, scene = this.weatherScene;
    // 云林天空：顶部蓝天向下过渡到树冠绿光；雨天由天气层再压暗一层。
    let sky = "#67C8F4";
    if (c.createLinearGradient) { const gradient = c.createLinearGradient(0, 0, 0, this.height); if (gradient?.addColorStop) { gradient.addColorStop(0, "#67C8F4"); gradient.addColorStop(.62, "#6FC3E6"); gradient.addColorStop(1, "#6FB58F"); sky = gradient; } }
    c.fillStyle = sky; c.fillRect(0, 0, this.width, this.height);
    drawWeatherBackdrop(c, scene);
    // 云朵随时间缓慢横向漂移，循环回绕。
    const shift = scene ? scene.cloudShift : 0, cloudAlpha = scene ? .8 - scene.rain * .25 : .8;
    c.fillStyle = `rgba(255,255,255,${cloudAlpha.toFixed(3)})`;
    [[42, 105, 34], [this.width - 58, 140, 28], [this.width * .26, this.height - 108, 30]].forEach(([baseX, y, r], index) => {
      const span = this.width + r * 4, x = ((baseX + shift * (.6 + index * .25)) % span + span) % span - r * 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.arc(x + r * .75, y + 5, r * .7, 0, Math.PI * 2); c.arc(x - r * .75, y + 7, r * .65, 0, Math.PI * 2); c.fill();
    });
  }
  drawHeader(snapshot, view) {
    const c = this.ctx, headerY = 18, rowGap = 8, buttonHeight = 30, buttonFill = "#FFFFFF", buttonBorder = "#1B1B1B", buttonText = "#171717", title = view.clockActive ? `时间挑战 ${view.clockTier.label}` : view.mode === "daily" ? "每日挑战" : view.mode === "challenge" ? (view.challengeTitle || "关卡挑战") : `${view.difficultyLabel} ${this.level.gridSize}`;
    // Using the current board layout keeps the left edge stable across 6×6 to 12×12 boards.
    const boardLeft = this.layout().left;
    const drawTopButton = (control, label, x, y, width, font = "700 11px Microsoft YaHei, sans-serif") => { this.controls[control] = { x, y, width, height: buttonHeight }; this.rounded(x, y, width, buttonHeight, 14, buttonFill, buttonBorder); c.fillStyle = buttonText; c.font = font; c.textAlign = "center"; c.fillText(label, x + width / 2, y + 20); };
    // 左侧金字塔：三层同左边线，宽度自上而下增加。
    drawTopButton("info", "i", boardLeft, headerY, 44, "700 17px Georgia, serif");
    const themeRowY = headerY + buttonHeight + rowGap;
    drawTopButton("theme", "棋盘颜色", boardLeft, themeRowY, 84);
    drawTopButton("selectedLevel", `已选 · ${title}`, boardLeft, headerY + (buttonHeight + rowGap) * 2, 116, "700 10px Microsoft YaHei, sans-serif");
    this.controls.sound = { x: this.width - 75, y: headerY, width: 58, height: buttonHeight }; this.rounded(this.controls.sound.x, headerY, 58, buttonHeight, 14, buttonFill, buttonBorder); c.fillStyle = buttonText; c.font = "700 11px Microsoft YaHei, sans-serif"; c.textAlign = "center"; c.fillText(`音效 ${view.sound ? "开" : "关"}`, this.width - 46, headerY + 20);
    // 右侧第三行：成就入口，显示已解锁数量。
    const badgeSummary = view.badgeSummary || { unlocked: 0, total: 0 }, badgeButtonY = headerY + (buttonHeight + rowGap) * 2, badgeButtonWidth = 84;
    this.controls.badges = { x: this.width - 17 - badgeButtonWidth, y: badgeButtonY, width: badgeButtonWidth, height: buttonHeight };
    this.rounded(this.controls.badges.x, badgeButtonY, badgeButtonWidth, buttonHeight, 14, buttonFill, buttonBorder); c.fillStyle = buttonText; c.font = "700 11px Microsoft YaHei, sans-serif"; c.textAlign = "center"; c.fillText(`🏅 成就 ${badgeSummary.unlocked}/${badgeSummary.total}`, this.controls.badges.x + badgeButtonWidth / 2, badgeButtonY + 20);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
  }
  // 时间与分数：白色，位于状态条（数字 / 错误 / 连击）正上方，以屏幕中线为轴左右对称。
  drawScoreTime(view) {
    const c = this.ctx, box = this.board; if (!box) return;
    const statusGap = 10, timerText = `◷ ${view.time}`, scoreText = view.clockActive ? `${view.clockSolved} 局` : `Points: ${view.points}`;
    const maxWidth = this.width / 2 - statusGap - 12, y = box.top - 50;
    c.fillStyle = "#FFFFFF"; c.font = `700 ${this.fitStatusFontSize([[timerText, maxWidth], [scoreText, maxWidth]])}px Microsoft YaHei, sans-serif`; c.textBaseline = "middle";
    c.textAlign = "right"; c.fillText(timerText, this.width / 2 - statusGap, y); c.textAlign = "left"; c.fillText(scoreText, this.width / 2 + statusGap, y);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
  }
  fitStatusFontSize(constraints, preferred = 22, minimum = 14) {
    const c = this.ctx; if (!c.measureText) return preferred;
    for (let size = preferred; size > minimum; size -= 1) {
      c.font = `700 ${size}px Microsoft YaHei, sans-serif`;
      if (constraints.every(([label, maxWidth]) => !(maxWidth > 0) || (c.measureText(label)?.width || 0) <= maxWidth)) return size;
    }
    return minimum;
  }
  drawBoard(snapshot, view = {}) {
    const c = this.ctx, box = this.layout(), level = this.level, palette = getBoardTheme(view.boardTheme).palette; this.board = box; this.rounded(box.left-8, box.top-8, box.width+16, box.width+16, 14, palette.boardFill, palette.boardBorder); c.strokeStyle = palette.grid; c.lineWidth = 1;
    for (let index=0; index<=level.rows; index+=1) { c.beginPath(); c.moveTo(box.left, box.top+index*box.cell); c.lineTo(box.left+box.width, box.top+index*box.cell); c.stroke(); c.beginPath(); c.moveTo(box.left+index*box.cell, box.top); c.lineTo(box.left+index*box.cell, box.top+box.width); c.stroke(); }
    c.strokeStyle=palette.wall;c.lineWidth=Math.max(3,box.cell*.08);(level.walls||[]).forEach((wall)=>{const [direction,rowText,colText]=wall.split("_");const row=Number(rowText),col=Number(colText);c.beginPath();if(direction==="H"){const y=box.top+(row+1)*box.cell;c.moveTo(box.left+col*box.cell+box.cell*.14,y);c.lineTo(box.left+(col+1)*box.cell-box.cell*.14,y);}else{const x=box.left+(col+1)*box.cell;c.moveTo(x,box.top+row*box.cell+box.cell*.14);c.lineTo(x,box.top+(row+1)*box.cell-box.cell*.14);}c.stroke();});
    // 关卡挑战障碍格：深灰圆角块，不可点选、不作为目标。
    (level.blockedCells||[]).forEach((cell)=>{const bx=box.left+cell.col*box.cell,by=box.top+cell.row*box.cell;this.rounded(bx+2,by+2,box.cell-4,box.cell-4,6,"#6b7280","#374151");});
    const fruitMem = view.fruitMemory;
    const hideFruitPlay = fruitMem?.active && !fruitMem.previewing && !fruitMem.hiding && !fruitMem.replay;
    const rhythm = view.challengeRhythm;
    const mem = view.challengeMemory;
    const hideIcons = (mem?.active && mem.hidden) || hideFruitPlay;
    const memoryMode = mem?.mode || "hidden";
    if (rhythm?.active && !hideIcons) {
      rhythm.groups.forEach((group) => {
        const fill = colorAlpha(group.color, group.current ? .34 : .16);
        group.cells.forEach((cell) => { this.rounded(box.left + cell.col * box.cell + 3, box.top + cell.row * box.cell + 3, box.cell - 6, box.cell - 6, 7, fill); });
      });
    }
    if (rhythm?.active) this.drawChallengeRhythm(rhythm, box);
    if(snapshot.path.length){const start=snapshot.path[0],end=snapshot.path[snapshot.path.length-1],startX=box.left+(start.col+.5)*box.cell,startY=box.top+(start.row+.5)*box.cell,endX=box.left+(end.col+.5)*box.cell,endY=box.top+(end.row+.5)*box.cell;const gradient=c.createLinearGradient?.(startX,startY,endX||startX+1,endY||startY+1);if(gradient?.addColorStop){gradient.addColorStop(0,palette.pathStart);gradient.addColorStop(.5,palette.pathMiddle);gradient.addColorStop(1,palette.pathEnd);c.strokeStyle=gradient;}else c.strokeStyle=palette.pathFallback;c.lineWidth=Math.max(56/3,box.cell*38/75);c.lineCap="round";c.lineJoin="round";c.beginPath();snapshot.path.forEach((cell,index)=>{const x=box.left+(cell.col+.5)*box.cell,y=box.top+(cell.row+.5)*box.cell;if(index)c.lineTo(x,y);else c.moveTo(x,y)});c.stroke();}
    if (view.fruitMemory?.showSolution && level.solution?.length) {
      c.save?.(); c.globalAlpha = .35; c.strokeStyle = "#b94232"; c.lineWidth = Math.max(2, box.cell * .08); c.lineCap = "round"; c.beginPath();
      level.solution.forEach((cell, index) => { const x = box.left + (cell.col + .5) * box.cell, y = box.top + (cell.row + .5) * box.cell; if (index) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke(); c.globalAlpha = 1; c.restore?.();
    }
    // 提示高亮：柔和金色圆斑，多格时依次减淡。
    const hintCells = view.hintCells || snapshot.hintCells || [];
    hintCells.forEach((cell, index) => { const x = box.left + (cell.col + .5) * box.cell, y = box.top + (cell.row + .5) * box.cell; c.fillStyle = `rgba(255,214,90,${(.55 - index * .08).toFixed(2)})`; c.beginPath(); c.arc(x, y, box.cell * .36, 0, Math.PI * 2); c.fill(); });
    // 错误反馈：被拒绝的格子红色闪烁边框。
    const feedback = view.feedback;
    if (feedback?.kind === "error" && feedback.cell) { const age = Math.max(0, Date.now() - (feedback.at || 0)), alpha = Math.max(0, .9 - age / 800); c.strokeStyle = `rgba(217,77,63,${alpha.toFixed(2)})`; c.lineWidth = 3; this.rounded(box.left + feedback.cell.col * box.cell + 2, box.top + feedback.cell.row * box.cell + 2, box.cell - 4, box.cell - 4, 6, null, c.strokeStyle); }
    const passed = new Set(snapshot.path.map((cell) => `${cell.row}-${cell.col}`));
    const showFruitReplay = Boolean(fruitMem?.replay);
    const hideProgress = fruitMem?.hideProgress || 0;
    level.waypoints.forEach((point)=>{const isPassed = passed.has(`${point.cell.row}-${point.cell.col}`);
      // 全藏：未点选不画。淡影：未点选半透明。闪现：仅在闪光窗内画出未点选图案。
      if (hideFruitPlay && !showFruitReplay) {
        if (fruitMem?.fruit10Reached && point.number === level.waypoints.length && isPassed) {
          const x=box.left+(point.cell.col+.5)*box.cell,y=box.top+(point.cell.row+.5)*box.cell;
          c.fillStyle = "rgba(120,120,120,.55)"; c.beginPath(); c.arc(x, y, box.cell * .28, 0, Math.PI * 2); c.fill();
          c.fillStyle = "#6b7280"; c.font = `700 ${Math.max(11, box.cell / 4)}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("锁", x, y);
        }
        return;
      }
      if (hideIcons && !isPassed && !showFruitReplay) {
        if (memoryMode === "hidden") return;
        if (memoryMode === "flash" && !mem.flashVisible) return;
      }
      const x=box.left+(point.cell.col+.5)*box.cell,y=box.top+(point.cell.row+.5)*box.cell;
      // 连线进行中不提示下一个数字（无底圈/高亮/脉冲）；已经过的数字略淡以示完成。
      let iconAlpha = isPassed ? .72 : 1;
      if (hideIcons && !isPassed && memoryMode === "faded") iconAlpha = FADED_ICON_ALPHA;
      c.globalAlpha = iconAlpha; c.fillStyle=palette.number; c.font=`700 ${Math.max(16,box.cell/3)}px Microsoft YaHei, sans-serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText(point.icon || String(point.number),x,y);
      if (showFruitReplay && point.number) {
        c.font = `700 ${Math.max(9, box.cell / 5)}px sans-serif`; c.fillStyle = "#b94232"; c.fillText(String(point.number), x + box.cell * .28, y - box.cell * .28);
      }
      c.globalAlpha = 1;}); c.textAlign="left"; c.textBaseline="alphabetic";
    if (feedback?.kind === "error" && feedback.cell) {
      const fruit = level.waypoints.find((point) => point.cell.row === feedback.cell.row && point.cell.col === feedback.cell.col);
      if (fruit) {
        const x = box.left + (fruit.cell.col + .5) * box.cell, y = box.top + (fruit.cell.row + .5) * box.cell;
        c.globalAlpha = .95; c.fillStyle = "#d94d3f"; c.font = `700 ${Math.max(16, box.cell / 3)}px Microsoft YaHei, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(fruit.icon || "●", x, y); c.globalAlpha = 1;
      }
    }
    // 连击 / 路标反馈文字：飘在被触达格子上方。
    if (feedback?.text && feedback.cell && feedback.kind !== "error") { const age = Math.max(0, Date.now() - (feedback.at || 0)), alpha = Math.max(0, 1 - age / 700), rise = Math.min(18, age / 30); const x = box.left + (feedback.cell.col + .5) * box.cell, y = box.top + feedback.cell.row * box.cell - 6 - rise; c.globalAlpha = alpha; c.fillStyle = feedback.kind === "combo" ? "#FF922B" : "#FFFFFF"; c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = 3; c.font = `700 ${feedback.kind === "combo" ? 16 : 13}px Microsoft YaHei, sans-serif`; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.strokeText?.(feedback.text, x, y); c.fillText(feedback.text, x, y); c.globalAlpha = 1; c.textAlign = "left"; }
    this.drawScoreTime(view);
    this.drawStatusStrip(view);
  }
  // 棋盘上方一行状态：当前数字 / 错误 / 连击 / 最佳。
  drawStatusStrip(view) {
    const status = view.status; if (!status) return;
    const c = this.ctx, box = this.board, y = box.top - 8 - 14;
    // 记忆关：状态条位置改为显示预览倒计时或“当前要找的图案”。
    const fruit = view.fruitMemory;
    if (fruit?.active && (fruit.tutorial || fruit.previewing || fruit.hiding)) return;
    if (fruit?.active) {
      const remain = Math.max(0, Math.ceil((fruit.connectRemainingMs || 0) / 1000));
      const text = `覆盖：${fruit.covered} / ${fruit.totalCells}     时间：${remain} 秒`;
      c.font = "700 13px Microsoft YaHei, sans-serif"; c.textBaseline = "middle"; c.textAlign = "center";
      const bannerWidth = (c.measureText?.(text)?.width || text.length * 9) + 24;
      this.rounded(this.width / 2 - bannerWidth / 2, y - 12, bannerWidth, 24, 12, "rgba(20,40,54,.86)");
      c.fillStyle = "#ffffff"; c.fillText(text, this.width / 2, y);
      c.textBaseline = "alphabetic"; c.textAlign = "left";
      return;
    }
    const memory = view.challengeMemory;
    if (memory?.active) {
      let text;
      if (memory.previewRemainingMs > 0) text = `👀 记住图案位置 · ${Math.ceil(memory.previewRemainingMs / 1000)}`;
      else if (memory.currentIcon) {
        const category = view.challengeRhythm?.current?.label;
        text = `找出 ${category ? category + " · " : ""}${memory.currentIcon}${memory.showName && memory.currentName ? " " + memory.currentName : ""}`;
      }
      else text = "全部找到！";
      c.font = "700 13px Microsoft YaHei, sans-serif"; c.textBaseline = "middle"; c.textAlign = "center";
      const bannerWidth = (c.measureText?.(text)?.width || text.length * 9) + 24;
      this.rounded(this.width / 2 - bannerWidth / 2, y - 12, bannerWidth, 24, 12, "rgba(20,40,54,.86)");
      c.fillStyle = "#ffffff"; c.fillText(text, this.width / 2, y);
      c.textBaseline = "alphabetic"; c.textAlign = "left";
      return;
    }
    const items = [`数字 ${status.currentWaypoint}/${status.totalWaypoints}`, `错误 ${status.errors}`];
    if (status.combo >= 2) items.push(`连击 ×${status.combo}`);
    if (status.bestMs) items.push(`最佳 ${formatDuration(status.bestMs)}`);
    c.font = "700 11px Microsoft YaHei, sans-serif"; c.textBaseline = "middle"; c.textAlign = "center";
    const text = items.join("   ·   "); const width = (c.measureText?.(text)?.width || text.length * 7) + 20;
    this.rounded(this.width / 2 - width / 2, y - 11, width, 22, 11, "rgba(255,255,255,.82)");
    c.fillStyle = "#1f2a30"; c.fillText(text, this.width / 2, y);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
  }
  drawChallengeRhythm(rhythm, box) {
    const c = this.ctx, groups = rhythm.groups || [];
    if (!groups.length) return;
    const gap = 4, bandH = 16, width = (box.width - gap * (groups.length - 1)) / groups.length, y = box.top + 4;
    groups.forEach((group, index) => {
      const x = box.left + index * (width + gap);
      this.rounded(x, y, width, bandH, 8, colorAlpha(group.color, group.current ? .92 : group.found === group.total ? .55 : .28), group.current ? "#ffffff" : null);
      c.fillStyle = group.current || group.found === group.total ? "#ffffff" : "#2e3a40";
      c.font = "700 10px Microsoft YaHei, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(group.label, x + width / 2, y + bandH / 2 + 1);
    });
    c.textAlign = "left"; c.textBaseline = "alphabetic";
  }
  drawControls(snapshot, view) {
    const c=this.ctx,total=Math.min(this.width-36,360),left=(this.width-total)/2,gap=8,h=this.board.rowHeight,verticalGap=this.board.controlGap,top=this.board.top+this.board.width+this.board.outerBorder+verticalGap,buttonFill="#fff",textColor="#111",border="#3f2a20",selectedBorder="#d94d3f"; c.lineWidth=2;
    const button=(id,label,x,y,width,selected=false)=>{this.controls[id]={x,y,width,height:h};this.rounded(x,y,width,h,8,buttonFill,selected?selectedBorder:border);c.fillStyle=textColor;c.font="700 12px Microsoft YaHei, sans-serif";c.textAlign="center";c.fillText(label,x+width/2,y+22);};
    const fruit = view.fruitMemory;
    const undoLabel = fruit?.active ? `↶ 撤回 ${fruit.undosLeft}` : "↶ 撤回";
    const resetLabel = fruit?.active ? "放弃" : "⌫ 清空";
    const two=(total-gap)/2;
    button("undo", undoLabel, left, top, two); button("reset", resetLabel, left+two+gap, top, two);
    const difficultyRow=top+h+verticalGap; this.controls.difficulties=[]; ["简单","中等","困难"].forEach((label,index)=>{const width=(total-gap*2)/3,x=left+index*(width+gap),selected=view.difficulty===["easy","medium","hard"][index];this.controls.difficulties.push({x,y:difficultyRow,width,height:h,id:["easy","medium","hard"][index]});this.rounded(x,difficultyRow,width,h,8,buttonFill,selected?selectedBorder:border);c.fillStyle=textColor;c.font="700 12px Microsoft YaHei, sans-serif";c.textAlign="center";c.fillText(label,x+width/2,difficultyRow+22);});
    const sizeRow=difficultyRow+h+verticalGap; this.controls.sizes=[]; ["6x6","8x8","10x10","12x12"].forEach((label,index)=>{const width=(total-gap*3)/4,x=left+index*(width+gap),selected=view.gridSize===label;this.controls.sizes.push({x,y:sizeRow,width,height:h,id:label});this.rounded(x,sizeRow,width,h,8,buttonFill,selected?selectedBorder:border);c.fillStyle=textColor;c.font="700 12px Microsoft YaHei, sans-serif";c.fillText(label,x+width/2,sizeRow+22);});
    const modeRow=sizeRow+h+verticalGap; button("daily","每日挑战",left,modeRow,two,view.mode==="daily"); button("challenge","🎯 关卡挑战",left+two+gap,modeRow,two,view.mode==="challenge");
    const clockRow=modeRow+h+verticalGap; this.controls.clock={x:left,y:clockRow,width:total,height:h};this.rounded(left,clockRow,total,h,9,"#35a853","#176b46");c.fillStyle="#fff";c.font="700 13px Microsoft YaHei, sans-serif";c.fillText("⏱ 时间挑战  Beat the Clock",left+total/2,clockRow+22);c.textAlign="left";
  }
  modalFrame(height) { const w=Math.min(this.width-40,340),x=(this.width-w)/2,y=Math.max(92,(this.height-height)/2); const c=this.ctx; c.fillStyle="rgba(9,54,86,.72)";c.fillRect(0,0,this.width,this.height);this.rounded(x,y,w,height,18,"#fffdf8","#b94232");return {x,y,w,height}; }
  drawClockSetup(view) {
    const c=this.ctx,frame=this.modalFrame(292),{x,y,w}=frame; this.controls.clockTiers=[];this.controls.clockCancel={x:x+w-38,y:y+12,width:26,height:26};this.rounded(this.controls.clockCancel.x,this.controls.clockCancel.y,26,26,13,"#f2f0ec");c.fillStyle="#73706a";c.font="700 19px sans-serif";c.textAlign="center";c.fillText("×",x+w-25,y+31);c.fillStyle="#25313a";c.font="italic 700 25px serif";c.fillText("Beat the Clock",this.width/2,y+58);c.fillStyle="#717a7f";c.font="12px sans-serif";c.fillText("60秒内连续解题，每局按档位奖励时间",this.width/2,y+82);const gap=7,tierW=(w-32-gap*3)/4,tierY=y+105;view.clockTiers.forEach((tier,index)=>{const tx=x+16+index*(tierW+gap);this.controls.clockTiers.push({x:tx,y:tierY,width:tierW,height:80,id:tier.id});this.rounded(tx,tierY,tierW,80,9,"#fff","#d6d0c8");c.fillStyle="#26333b";c.font="700 12px serif";c.fillText(tier.label,tx+tierW/2,tierY+25);c.fillStyle="#e36a3e";c.font="700 11px sans-serif";c.fillText(`+${Math.round((tier.bonusMs||8000)/1000)} 秒`,tx+tierW/2,tierY+47);c.fillStyle="#717a7f";c.font="10px sans-serif";c.fillText(tier.gridSize,tx+tierW/2,tierY+66);});c.fillStyle="#35a853";this.rounded(x+18,y+210,w-36,38,9,"#35a853","#176b46");c.fillStyle="#fff";c.font="700 13px Microsoft YaHei, sans-serif";c.fillText("选择一个档位开始挑战",this.width/2,y+235);c.textAlign="left";
  }
  drawClockResult(view) {
    const c=this.ctx,frame=this.modalFrame(278),{x,y,w}=frame,result=view.clockResult||{},current=result.current||{solved:0,remainingMs:0},best=result.best||current; this.controls.clockLeaderboard={x:x+20,y:y+188,width:w-40,height:32};this.controls.clockRestart={x:x+20,y:y+228,width:w-40,height:34};
    this.controls.clockClose={x:x+w-38,y:y+12,width:26,height:26};this.rounded(this.controls.clockClose.x,this.controls.clockClose.y,26,26,13,"#f2f0ec");c.fillStyle="#73706a";c.font="700 19px sans-serif";c.textAlign="center";c.fillText("×",x+w-25,y+31);
    c.fillStyle="#fff1e8";c.beginPath();c.arc(this.width/2,y+36,22,0,Math.PI*2);c.fill();c.fillStyle="#e36a3e";c.font="700 23px serif";c.textAlign="center";c.fillText("⌛",this.width/2,y+44);c.fillStyle="#25313a";c.font="italic 700 25px serif";c.fillText("时间到！",this.width/2,y+79);c.fillStyle="#717a7f";c.font="12px sans-serif";c.fillText(`${result.tier?.label || ""}挑战 · 已完成 ${current.solved} 局 · 剩余 ${formatDuration(current.remainingMs)}`,this.width/2,y+103);this.rounded(x+24,y+120,w-48,48,10,"#f2f0ec");c.fillStyle="#e36a3e";c.font="700 18px serif";c.fillText(`${best.solved} 局`,this.width/2,y+143);c.fillStyle="#74706a";c.font="10px sans-serif";c.fillText("本地最佳成绩",this.width/2,y+159);c.fillStyle="#717a7f";c.font="11px sans-serif";c.fillText(view.rankings.global.text,this.width/2,y+183);this.rounded(this.controls.clockLeaderboard.x,this.controls.clockLeaderboard.y,this.controls.clockLeaderboard.width,32,9,"#fff","#d6d0c8");c.fillStyle="#303b40";c.font="700 12px sans-serif";c.fillText("查看时间挑战好友榜",this.width/2,y+209);this.rounded(this.controls.clockRestart.x,this.controls.clockRestart.y,this.controls.clockRestart.width,34,9,"#35a853","#176b46");c.fillStyle="#fff";c.font="700 12px Microsoft YaHei, sans-serif";c.fillText("再来一次",this.width/2,y+250);c.textAlign="left";
  }
  drawThemePicker(view) {
    // 92px 标题区 + 选项网格 + 14px 底部留白（最后一行不带 rowGap）。
    const columns = 2, optionHeight = 42, rowGap = 6, rows = Math.ceil(BOARD_THEMES.length / columns), modalHeight = 92 + rows * (optionHeight + rowGap) - rowGap + 14;
    const c = this.ctx, frame = this.modalFrame(modalHeight), { x, y, w } = frame, active = getBoardTheme(view.boardTheme).id;
    this.lastThemeModalHeight = modalHeight;
    this.controls.themeClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.controls.themeOptions = [];
    this.rounded(this.controls.themeClose.x, this.controls.themeClose.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.fillText("棋盘颜色", this.width / 2, y + 51);
    c.fillStyle = "#69757a"; c.font = "11px Microsoft YaHei, sans-serif"; c.fillText("肽白为默认 · 诗意中国色 · 主题关解锁奖励皮肤", this.width / 2, y + 74);
    const outerInset = 20, columnGap = 8, optionWidth = (w - outerInset * 2 - columnGap) / columns, unlocks = view.boardThemeUnlocks || {};
    BOARD_THEMES.forEach((theme, index) => { const column = index % columns, row = Math.floor(index / columns); const option = { x: x + outerInset + column * (optionWidth + columnGap), y: y + 92 + row * (optionHeight + rowGap), width: optionWidth, height: optionHeight, id: theme.id }; this.controls.themeOptions.push(option); const unlocked = unlocks[theme.id] !== false; this.rounded(option.x, option.y, option.width, option.height, 10, unlocked ? "#fff" : "#f4f3f0", theme.id === active ? theme.palette.boardBorder : "#d6d0c8"); c.fillStyle = theme.swatch; c.beginPath(); c.arc(option.x + 20, option.y + 21, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = unlocked ? "#2e3a40" : "#8a8f97"; c.font = "700 10px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(theme.label, option.x + 38, option.y + 18); c.fillStyle = "#798287"; c.font = "9px sans-serif"; c.fillText(unlocked ? theme.subtitle : (theme.unlock?.hint || "未解锁"), option.x + 38, option.y + 32); if (theme.id === active) { c.fillStyle = theme.palette.pathEnd; c.font = "700 12px sans-serif"; c.textAlign = "right"; c.fillText("✓", option.x + option.width - 10, option.y + 26); } else if (!unlocked) { c.fillStyle = "#8a8f97"; c.font = "700 12px sans-serif"; c.textAlign = "right"; c.fillText("🔒", option.x + option.width - 10, option.y + 26); } });
    c.textAlign = "left";
  }
  drawChallengeSelect(view) {
    const c = this.ctx, themes = view.challengeThemes || [];
    const rowH = 34, rowGap = 6, themeHeader = 28, themeGap = 10, titleArea = 66, bottomPad = 16, inset = 20;
    const bodyHeight = themes.reduce((sum, theme) => sum + themeHeader + theme.levels.length * (rowH + rowGap), 0) + themeGap * Math.max(0, themes.length - 1);
    const modalHeight = titleArea + bodyHeight + bottomPad;
    const frame = this.modalFrame(modalHeight), { x, y, w } = frame;
    this.controls.challengeClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.controls.challengeLevels = [];
    this.rounded(this.controls.challengeClose.x, this.controls.challengeClose.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.fillText("关卡挑战", this.width / 2, y + 40);
    c.fillStyle = "#69757a"; c.font = "11px Microsoft YaHei, sans-serif"; c.fillText("自由选择 · 集齐主题关卡解锁奖励皮肤", this.width / 2, y + 58);
    let cursor = y + titleArea;
    const rowWidth = w - inset * 2;
    themes.forEach((theme) => {
      const progress = `${theme.cleared || 0}/${theme.total || theme.levels.length} · ${theme.stars || 0}★${theme.skinUnlocked ? " · 皮肤已解锁" : ""}`;
      c.fillStyle = "#2e3a40"; c.font = "700 13px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(`${theme.icon} ${theme.label}`, x + inset, cursor + 18);
      c.fillStyle = "#8a9298"; c.font = "10px Microsoft YaHei, sans-serif"; c.textAlign = "right"; c.fillText(progress, x + inset + rowWidth, cursor + 18);
      cursor += themeHeader;
      theme.levels.forEach((level) => {
        const box = { x: x + inset, y: cursor, width: rowWidth, height: rowH, id: level.id };
        this.controls.challengeLevels.push(box);
        this.rounded(box.x, box.y, box.width, box.height, 9, "#fff", "#d6d0c8");
        c.fillStyle = "#2e3a40"; c.font = "700 12px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(`第${level.index}关 · ${level.title}`, box.x + 12, box.y + 15);
        c.fillStyle = "#8a9298"; c.font = "10px Microsoft YaHei, sans-serif"; c.fillText(`${level.gridSize}${level.bestMs ? " · 最佳 " + formatDuration(level.bestMs) : ""}`, box.x + 12, box.y + 28);
        const stars = "★".repeat(level.stars) + "☆".repeat(Math.max(0, 3 - level.stars));
        c.fillStyle = "#f2a900"; c.font = "700 14px sans-serif"; c.textAlign = "right"; c.fillText(stars, box.x + box.width - 12, box.y + 22);
        cursor += rowH + rowGap;
      });
      cursor += themeGap;
    });
    c.textAlign = "left";
  }
  drawInfo() {
    const c = this.ctx, frame = this.modalFrame(412), { x, y, w } = frame;
    this.controls.infoClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.controls.infoDismiss = { x: x + 22, y: y + 354, width: w - 44, height: 38 };
    this.rounded(this.controls.infoClose.x, this.controls.infoClose.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#e6f8ee"; c.beginPath(); c.arc(this.width / 2, y + 40, 23, 0, Math.PI * 2); c.fill(); c.fillStyle = "#16834a"; c.font = "700 27px Georgia, serif"; c.fillText("i", this.width / 2, y + 49);
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.fillText("玩法说明", this.width / 2, y + 84);
    c.fillStyle = "#6c777b"; c.font = "12px Microsoft YaHei, sans-serif"; c.fillText("从 1 号数字出发，用一条连续路径走遍棋盘", this.width / 2, y + 108);
    const rules = [
      ["1", "按 1、2、3、4… 的顺序经过所有数字路标。"],
      ["2", "只能上下左右移动；不能斜走，也不能穿过墙体。"],
      ["3", "每格只走一次，覆盖全盘并抵达末号通关。"],
    ];
    rules.forEach(([index, text], offset) => { const rowY = y + 140 + offset * 49; c.fillStyle = "#35a853"; c.beginPath(); c.arc(x + 34, rowY - 4, 12, 0, Math.PI * 2); c.fill(); c.fillStyle = "#fff"; c.font = "700 12px sans-serif"; c.fillText(index, x + 34, rowY); c.fillStyle = "#334047"; c.font = "12px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(text, x + 56, rowY); c.textAlign = "center"; });
    c.strokeStyle = "#dedbd4"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 24, y + 280); c.lineTo(x + w - 24, y + 280); c.stroke();
    c.fillStyle = "#69757a"; c.font = "11px Microsoft YaHei, sans-serif"; c.fillText("无限：自由选规格和难度  ·  每日：同日同题", this.width / 2, y + 306); c.fillText("水果乐园：10秒记忆盲连全盘  ·  太空：图案点选", this.width / 2, y + 326);
    this.rounded(this.controls.infoDismiss.x, this.controls.infoDismiss.y, this.controls.infoDismiss.width, this.controls.infoDismiss.height, 9, "#35a853", "#176b46"); c.fillStyle = "#fff"; c.font = "700 13px Microsoft YaHei, sans-serif"; c.fillText("知道了", this.width / 2, y + 379); c.textAlign = "left";
  }
  drawCompletion(snapshot, view) {
    const c = this.ctx, w = Math.min(this.width - 40, 340), h = 444, x = (this.width - w) / 2, y = Math.max(80, (this.height - h) / 2), summary = view.completion, rankings = view.rankings;
    const stars = Math.min(3, Math.max(0, summary.stars || 0)), labels = summary.labels || [], breakdown = summary.breakdown, stats = summary.stats || {};
    this.controls.completion = { x, y, width: w, height: h };
    c.fillStyle = "rgba(9,54,86,.72)"; c.fillRect(0, 0, this.width, this.height); this.drawCompletionFireworks(); this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    this.controls.close = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.rounded(this.controls.close.x, this.controls.close.y, 26, 26, 13, "#f2f0ec"); c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", this.controls.close.x + 13, this.controls.close.y + 19);
    c.fillStyle = "#25313a"; c.font = "italic 700 26px serif"; c.fillText("通关啦！", this.width / 2, y + 44);
    // 星级：金色实心 / 灰色空心。
    c.font = "700 26px sans-serif";
    [0, 1, 2].forEach((index) => { c.fillStyle = index < stars ? "#F5B301" : "#D9D4CC"; c.fillText("★", this.width / 2 + (index - 1) * 32, y + 78); });
    // 评价标签：Perfect / Great / Fast / Combo ×N。
    if (labels.length) { c.fillStyle = "#e36a3e"; c.font = "700 13px sans-serif"; c.fillText(labels.join("  ·  "), this.width / 2, y + 102); }
    const cardTop = y + 118, cardGap = 8, cardW = (w - 40 - cardGap * 2) / 3;
    const metric = [{ value: view.time, label: "本局用时" }, { value: String(stats.errors ?? 0), label: "错误" }, { value: stats.hints ? `${stats.hints} 次` : "未使用", label: "提示" }];
    metric.forEach((item, index) => { const cx = x + 20 + index * (cardW + cardGap); this.rounded(cx, cardTop, cardW, 54, 10, "#f2f0ec"); c.fillStyle = "#e36a3e"; c.font = "700 17px serif"; c.fillText(item.value, cx + cardW / 2, cardTop + 23); c.fillStyle = "#74706a"; c.font = "10px sans-serif"; c.fillText(item.label, cx + cardW / 2, cardTop + 42); });
    // 分数拆解：一行总分 + 一行来源。
    const scoreY = cardTop + 78;
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.fillText(`+${breakdown ? breakdown.total : view.points} 分`, this.width / 2, scoreY);
    if (breakdown) {
      const parts = [`基础 ${breakdown.base}`];
      if (breakdown.coverBonus) parts.push(`覆盖 +${breakdown.coverBonus}`);
      if (breakdown.memoryBonus) parts.push(`记忆 +${breakdown.memoryBonus}`);
      if (breakdown.noUndoBonus) parts.push(`零撤 +${breakdown.noUndoBonus}`);
      if (breakdown.speedBonus) parts.push(`速度 +${breakdown.speedBonus}`);
      if (breakdown.noMistakeBonus) parts.push(`无错 +${breakdown.noMistakeBonus}`);
      if (breakdown.comboBonus) parts.push(`连击 +${breakdown.comboBonus}`);
      if (breakdown.streakBonus) parts.push(`连胜 +${breakdown.streakBonus}`);
      const penalty = breakdown.hintPenalty + breakdown.undoPenalty + breakdown.errorPenalty;
      if (penalty) parts.push(`扣 −${penalty}`);
      c.fillStyle = "#7b7470"; c.font = "10px sans-serif"; c.fillText(parts.join(" · "), this.width / 2, scoreY + 18);
    }
    const bestLine = `最佳 ${formatDuration(summary.best.elapsedMs)} · 连续通关 ${summary.winStreak ?? summary.streak} 局${summary.hintReward ? ` · 三星奖励提示 +${summary.hintReward}` : ""}`;
    c.fillStyle = "#2d3b43"; c.font = "700 12px sans-serif"; c.fillText(bestLine, this.width / 2, scoreY + 44);
    // 成就反馈优先于排行榜文案：本局新徽章 / 升级 → 距离下一徽章 → 总榜。
    const badgeEvents = summary.achievementEvents?.badges || [], goals = summary.nextGoals || [];
    let infoY = scoreY + 64;
    if (badgeEvents.length) {
      const first = badgeEvents[0], badge = view.badgeLookup?.(first.id), label = first.type === "upgrade" ? `${badge?.name || first.id} 升级为${TIER_LABELS[first.tier]}` : `新徽章 · ${badge?.name || first.id}（${TIER_LABELS[first.tier]}）`;
      if (badge) this.drawBadgeIcon(x + 24, infoY - 16, 30, { ...badge, tier: first.tier });
      c.fillStyle = "#b94232"; c.font = "700 12px Microsoft YaHei, sans-serif"; c.textAlign = "left"; c.fillText(this.truncate(label + (badgeEvents.length > 1 ? ` 等 ${badgeEvents.length} 项` : ""), w - 90, c.font), x + 62, infoY + 2); c.textAlign = "center";
      infoY += 22;
    }
    if (goals.length) { c.fillStyle = "#69757a"; c.font = "10px Microsoft YaHei, sans-serif"; c.fillText(this.truncate(`距离下一徽章：${goals.map((goal) => `${goal.name}还需 ${goal.remaining}`).join(" · ")}`, w - 48, c.font), this.width / 2, infoY); infoY += 16; }
    const rewardUnlocks = summary.rewardUnlocks || [];
    if (rewardUnlocks.length) { c.fillStyle = "#e36a3e"; c.font = "700 11px Microsoft YaHei, sans-serif"; c.fillText(rewardUnlocks.map((item) => `解锁皮肤 · ${item.label}`).join("  ·  "), this.width / 2, infoY); infoY += 16; }
    if (summary.fruitLesson) { c.fillStyle = "#b94232"; c.font = "700 10px Microsoft YaHei, sans-serif"; c.fillText(summary.fruitLesson, this.width / 2, infoY); infoY += 16; }
    c.fillStyle = "#717a7f"; c.font = "11px sans-serif"; c.fillText(rankings.global.text, this.width / 2, infoY);
    const actionHeight = 34, actionInset = 12, nextY = y + h - actionInset - actionHeight, leaderboardY = nextY - actionHeight - 8, dividerY = leaderboardY - 10, halfW = (w - 44 - 8) / 2;
    c.strokeStyle = "#ddd8d2"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 24, dividerY); c.lineTo(x + w - 24, dividerY); c.stroke();
    this.controls.leaderboard = { x: x + 22, y: leaderboardY, width: halfW, height: actionHeight };
    this.rounded(this.controls.leaderboard.x, this.controls.leaderboard.y, halfW, actionHeight, 9, "#fff", "#d6d0c8"); c.fillStyle = "#303b40"; c.font = "700 12px sans-serif"; c.fillText("查看排行榜", x + 22 + halfW / 2, leaderboardY + 22);
    this.controls.viewBadges = { x: x + 22 + halfW + 8, y: leaderboardY, width: halfW, height: actionHeight };
    this.rounded(this.controls.viewBadges.x, this.controls.viewBadges.y, halfW, actionHeight, 9, "#fff", "#d6d0c8"); c.fillStyle = "#303b40"; c.fillText("查看徽章", this.controls.viewBadges.x + halfW / 2, leaderboardY + 22);
    this.controls.next = { x: x + 22, y: nextY, width: w - 44, height: actionHeight };
    this.rounded(this.controls.next.x, this.controls.next.y, this.controls.next.width, actionHeight, 9, "#35a853", "#176b46"); c.fillStyle = "#fff"; c.font = "700 12px sans-serif"; c.fillText("继续下一题", this.width / 2, nextY + 22); c.textAlign = "left";
  }
  toCell(point) { const b=this.board;if(!b||point.x<b.left||point.x>=b.left+b.width||point.y<b.top||point.y>=b.top+b.width)return null;return {row:Math.floor((point.y-b.top)/b.cell),col:Math.floor((point.x-b.left)/b.cell)}; }
  hit(box, point) { return box && point.x>=box.x && point.x<=box.x+box.width && point.y>=box.y && point.y<=box.y+box.height; }
  drawFruitMiniBoard(level, x, y, size, view) {
    const c = this.ctx, rows = level.rows, cell = size / rows, fruit = view.fruitMemory || {}, phase = fruit.phase, hide = fruit.hideProgress || 0;
    const flash = phase === "flash" && Math.floor(Date.now() / 120) % 2 === 0;
    this.rounded(x - 6, y - 6, size + 12, size + 12, 10, "#fffdf8", flash ? "#e36a3e" : "#d6d0c8");
    c.strokeStyle = "#ece9e3"; c.lineWidth = 1;
    for (let index = 0; index <= rows; index += 1) {
      c.beginPath(); c.moveTo(x, y + index * cell); c.lineTo(x + size, y + index * cell); c.stroke();
      c.beginPath(); c.moveTo(x + index * cell, y); c.lineTo(x + index * cell, y + size); c.stroke();
    }
    const pulse = phase === "pulse" ? 1 + Math.sin(Date.now() / 180) * 0.06 : 1;
    const numberAlpha = phase === "fade" ? Math.max(0, 1 - hide / 0.4) : 1;
    const iconAlpha = phase === "fade" ? Math.max(0, 1 - hide) : 1;
    const iconScale = phase === "fade" ? Math.max(0.2, 1 - hide * 0.8) : pulse;
    level.waypoints.forEach((point) => {
      const cx = x + (point.cell.col + .5) * cell, cy = y + (point.cell.row + .5) * cell;
      c.save?.();
      c.globalAlpha = iconAlpha;
      c.font = `700 ${Math.max(10, cell / 2.4 * iconScale)}px Microsoft YaHei, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#25313a";
      c.fillText(point.icon || "●", cx, cy);
      c.globalAlpha = numberAlpha;
      c.fillStyle = "#b94232"; c.font = `700 ${Math.max(8, cell / 4)}px sans-serif`;
      c.fillText(String(point.number), cx + cell * .28, cy - cell * .28);
      c.restore?.();
    });
    c.globalAlpha = 1; c.textAlign = "left"; c.textBaseline = "alphabetic";
  }
  drawFruitMemoryPopup(snapshot, view) {
    const fruit = view.fruitMemory; if (!fruit) return;
    const c = this.ctx, w = Math.min(this.width - 28, 360), h = 430, x = (this.width - w) / 2, y = Math.max(56, (this.height - h) / 2);
    const remain = Math.max(0, Math.ceil((fruit.previewRemainingMs || 0) / 1000));
    const fade = fruit.phase === "fade" ? Math.max(0, 1 - (fruit.hideProgress || 0)) : 1;
    c.save?.(); c.globalAlpha = fade;
    c.fillStyle = "rgba(9,54,86,.55)"; c.fillRect(0, 0, this.width, this.height);
    this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.textAlign = "center";
    c.fillText("水果记忆挑战", this.width / 2, y + 36);
    c.fillStyle = "#69757a"; c.font = "12px Microsoft YaHei, sans-serif";
    c.fillText("请记住 1～10 的水果和位置", this.width / 2, y + 58);
    const timerSize = fruit.phase === "countdown" ? 28 : 16;
    c.fillStyle = fruit.phase === "countdown" || fruit.phase === "flash" ? "#b94232" : "#25313a";
    c.font = `700 ${timerSize}px Microsoft YaHei, sans-serif`;
    c.fillText(`剩余观察时间：${remain}`, this.width / 2, y + 88);
    const mini = Math.min(w - 48, 240);
    this.drawFruitMiniBoard(this.level, x + (w - mini) / 2, y + 108, mini, view);
    c.fillStyle = "#69757a"; c.font = "12px Microsoft YaHei, sans-serif";
    c.fillText("10 秒后开始盲连", this.width / 2, y + h - 28);
    c.textAlign = "left"; c.restore?.();
    void snapshot;
  }
  drawFruitTutorial(view) {
    const c = this.ctx, w = Math.min(this.width - 32, 360), h = 500, x = (this.width - w) / 2, y = Math.max(48, (this.height - h) / 2);
    c.fillStyle = "rgba(9,54,86,.72)"; c.fillRect(0, 0, this.width, this.height);
    this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif"; c.textAlign = "center";
    c.fillText("水果乐园教学", this.width / 2, y + 40);
    c.fillStyle = "#69757a"; c.font = "12px Microsoft YaHei, sans-serif";
    c.fillText("10 秒水果记忆 + 全棋盘路线规划", this.width / 2, y + 62);
    FRUIT_TUTORIAL_STEPS.forEach((text, index) => {
      const rowY = y + 92 + index * 40;
      c.fillStyle = "#35a853"; c.beginPath(); c.arc(x + 28, rowY - 4, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.font = "700 11px sans-serif"; c.fillText(String(index + 1), x + 28, rowY);
      c.fillStyle = "#334047"; c.font = "11px Microsoft YaHei, sans-serif"; c.textAlign = "left";
      c.fillText(text, x + 46, rowY); c.textAlign = "center";
    });
    this.controls.fruitTutorialDismiss = { x: x + 22, y: y + h - 56, width: w - 44, height: 38 };
    this.rounded(this.controls.fruitTutorialDismiss.x, this.controls.fruitTutorialDismiss.y, w - 44, 38, 9, "#35a853", "#176b46");
    c.fillStyle = "#fff"; c.font = "700 13px Microsoft YaHei, sans-serif";
    c.fillText("开始记忆", this.width / 2, y + h - 31);
    c.textAlign = "left";
    void view;
  }
  drawFruitFail(snapshot, view) {
    const fruit = view.fruitMemory || {}, c = this.ctx, w = Math.min(this.width - 40, 340), h = 280, x = (this.width - w) / 2, y = Math.max(92, (this.height - h) / 2);
    c.fillStyle = "rgba(9,54,86,.55)"; c.fillRect(0, 0, this.width, this.height);
    this.rounded(x, y, w, h, 18, "#fffdf8", "#b94232");
    this.controls.fruitFailClose = { x: x + w - 38, y: y + 12, width: 26, height: 26 };
    this.rounded(this.controls.fruitFailClose.x, this.controls.fruitFailClose.y, 26, 26, 13, "#f2f0ec");
    c.fillStyle = "#73706a"; c.font = "700 19px sans-serif"; c.textAlign = "center"; c.fillText("×", x + w - 25, y + 31);
    c.fillStyle = "#25313a"; c.font = "700 22px Microsoft YaHei, sans-serif";
    c.fillText("本局结束", this.width / 2, y + 58);
    c.fillStyle = "#b94232"; c.font = "13px Microsoft YaHei, sans-serif";
    c.fillText(fruit.failReason || snapshot.message || "挑战失败", this.width / 2, y + 86);
    c.fillStyle = "#69757a"; c.font = "12px Microsoft YaHei, sans-serif";
    c.fillText(`已覆盖 ${fruit.covered || 0} / ${fruit.totalCells || 36} 格`, this.width / 2, y + 114);
    c.fillText("复盘路线最多显示 3 秒", this.width / 2, y + 136);
    this.controls.fruitFailRetry = { x: x + 22, y: y + h - 56, width: w - 44, height: 38 };
    this.rounded(this.controls.fruitFailRetry.x, this.controls.fruitFailRetry.y, w - 44, 38, 9, "#35a853", "#176b46");
    c.fillStyle = "#fff"; c.font = "700 13px Microsoft YaHei, sans-serif";
    c.textAlign = "center";
    c.fillText("再试一次", this.width / 2, y + h - 31);
    c.textAlign = "left";
  }
}

module.exports = { SingleBoardRenderer, FADED_ICON_ALPHA };
