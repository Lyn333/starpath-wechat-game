/** 关卡目录：使用 Canvas 绘制尺寸、难度筛选与分页关卡卡片，适配微信小游戏纵向屏幕。 */
class LevelLibraryRenderer {
  constructor(canvas, levels, progress) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.levels = levels;
    this.progress = progress;
    this.gridSize = "6x6";
    this.difficulty = "easy";
    this.page = 0;
    this.bounds = { size: [], difficulty: [], cards: [], previous: null, next: null };
    this.resize();
  }

  resize() {
    const info = wx.getWindowInfo();
    this.width = info.windowWidth;
    this.height = info.windowHeight;
    this.dpr = Math.min(info.pixelRatio || 1, 3);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  visibleLevels() { return this.levels.filter((level) => level.gridSize === this.gridSize && level.difficulty === this.difficulty); }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#0B2217"); gradient.addColorStop(1, "#153B29");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    this.drawMasthead();
    this.drawFilters();
    this.drawCards();
  }

  drawMasthead() {
    const ctx = this.ctx;
    ctx.fillStyle = "#D4BD7A"; ctx.font = "10px monospace"; ctx.fillText("FOREST TRAIL NOTES · 200", 22, 32);
    ctx.fillStyle = "#F4EFD9"; ctx.font = "600 29px serif"; ctx.fillText("选择林地", 22, 66);
    ctx.fillStyle = "rgba(244,239,217,.62)"; ctx.font = "12px sans-serif"; ctx.fillText("从林缘出发，逐一走通 200 条自然步道。", 22, 90);
    const total = Object.keys(this.progress.state.completed).length;
    ctx.fillStyle = "#8DCB91"; ctx.font = "11px monospace"; ctx.fillText(`已归档 ${String(total).padStart(3, "0")} / 200`, this.width - 122, 35);
  }

  drawFilters() {
    const ctx = this.ctx;
    this.bounds.size = []; this.bounds.difficulty = [];
    const sizes = ["6x6", "8x8"];
    const difficulties = [{ id: "easy", label: "林缘" }, { id: "medium", label: "林间" }, { id: "hard", label: "密林" }];
    ctx.fillStyle = "rgba(244,239,217,.5)"; ctx.font = "10px monospace"; ctx.fillText("棋盘尺寸", 22, 126);
    sizes.forEach((size, index) => this.drawPill({ x: 22 + index * 72, y: 139, width: 62, height: 32, label: size, active: size === this.gridSize, target: this.bounds.size, value: size }));
    ctx.fillStyle = "rgba(244,239,217,.5)"; ctx.font = "10px monospace"; ctx.fillText("林地难度", 22, 204);
    difficulties.forEach((item, index) => this.drawPill({ x: 22 + index * 86, y: 217, width: 76, height: 32, label: item.label, active: item.id === this.difficulty, target: this.bounds.difficulty, value: item.id }));
  }

  drawPill({ x, y, width, height, label, active, target, value }) {
    const ctx = this.ctx;
    ctx.fillStyle = active ? "#E2AF52" : "rgba(23,55,37,.82)"; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = active ? "#F2CB7A" : "rgba(244,239,217,.16)"; ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = active ? "#173725" : "#F4EFD9"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "600 11px sans-serif"; ctx.fillText(label, x + width / 2, y + height / 2 + 1); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    target.push({ x, y, width, height, value });
  }

  drawCards() {
    const ctx = this.ctx; const filtered = this.visibleLevels(); const pageSize = 9; const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); this.page = Math.min(this.page, pages - 1);
    const items = filtered.slice(this.page * pageSize, this.page * pageSize + pageSize); this.bounds.cards = [];
    const outer = 22; const gap = 10; const cardWidth = (this.width - outer * 2 - gap * 2) / 3; const cardHeight = Math.min(104, (this.height - 356) / 3);
    items.forEach((level, index) => {
      const row = Math.floor(index / 3); const col = index % 3; const x = outer + col * (cardWidth + gap); const y = 278 + row * (cardHeight + gap); const visibleIndex = this.page * pageSize + index;
      const unlocked = this.progress.isUnlocked(filtered, visibleIndex); const done = this.progress.isCompleted(level.id);
      ctx.fillStyle = unlocked ? "rgba(29,67,45,.94)" : "rgba(13,31,22,.7)"; ctx.fillRect(x, y, cardWidth, cardHeight); ctx.strokeStyle = done ? "#8DCB91" : (unlocked ? "rgba(226,175,82,.45)" : "rgba(244,239,217,.1)"); ctx.strokeRect(x, y, cardWidth, cardHeight);
      ctx.fillStyle = done ? "#8DCB91" : (unlocked ? "#E2AF52" : "rgba(244,239,217,.3)"); ctx.font = "10px monospace"; ctx.fillText(String(visibleIndex + 1).padStart(2, "0"), x + 10, y + 19);
      ctx.fillStyle = unlocked ? "#F4EFD9" : "rgba(244,239,217,.32)"; ctx.font = "600 14px serif"; ctx.fillText(level.title.split(" · ")[0], x + 10, y + 43);
      ctx.fillStyle = "rgba(244,239,217,.52)"; ctx.font = "9px monospace"; ctx.fillText(done ? "已走通" : (unlocked ? "可进入" : "待解锁"), x + 10, y + cardHeight - 14);
      if (unlocked) this.bounds.cards.push({ x, y, width: cardWidth, height: cardHeight, level });
    });
    const footerY = this.height - 44; ctx.fillStyle = "rgba(244,239,217,.58)"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.fillText(`${this.gridSize} · ${this.difficulty} · ${this.page + 1}/${pages}`, this.width / 2, footerY + 17); ctx.textAlign = "left";
    this.bounds.previous = { x: 22, y: footerY, width: 54, height: 30, enabled: this.page > 0 }; this.bounds.next = { x: this.width - 76, y: footerY, width: 54, height: 30, enabled: this.page < pages - 1 };
    [this.bounds.previous, this.bounds.next].forEach((button, index) => { ctx.fillStyle = button.enabled ? "rgba(53,39,25,.9)" : "rgba(244,239,217,.08)"; ctx.fillRect(button.x, button.y, button.width, button.height); ctx.fillStyle = button.enabled ? "#F4EFD9" : "rgba(244,239,217,.3)"; ctx.font = "15px sans-serif"; ctx.fillText(index ? "›" : "‹", button.x + 23, button.y + 21); });
  }

  hit(point) {
    const within = (box) => box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    const size = this.bounds.size.find((box) => within(box)); if (size) return { type: "size", value: size.value };
    const difficulty = this.bounds.difficulty.find((box) => within(box)); if (difficulty) return { type: "difficulty", value: difficulty.value };
    const card = this.bounds.cards.find((box) => within(box)); if (card) return { type: "level", level: card.level };
    if (within(this.bounds.previous) && this.bounds.previous.enabled) return { type: "previous" };
    if (within(this.bounds.next) && this.bounds.next.enabled) return { type: "next" };
    return null;
  }

  setSize(value) { this.gridSize = value; this.page = 0; this.render(); }
  setDifficulty(value) { this.difficulty = value; this.page = 0; this.render(); }
  previousPage() { this.page = Math.max(0, this.page - 1); this.render(); }
  nextPage() { this.page += 1; this.render(); }
}

module.exports = { LevelLibraryRenderer };
