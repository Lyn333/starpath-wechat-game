function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function easeOut(value) { const t = clamp(value); return 1 - (1 - t) ** 3; }
function easeInOut(value) { const t = clamp(value); return t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2; }

class OpeningSequence {
  constructor(canvas, options = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.duration = options.duration ?? 10000; this.onComplete = options.onComplete || (() => {});
    this.now = options.now || (() => Date.now()); this.schedule = options.schedule || ((callback) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : setTimeout(() => callback(this.now()), 16)); this.cancel = options.cancel || ((handle) => { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle); else clearTimeout(handle); });
    this.active = false; this.completed = false; this.frame = null; this.startAt = 0; this.resize();
  }
  resize() {
    const info = typeof wx !== "undefined" && wx.getWindowInfo ? wx.getWindowInfo() : { windowWidth: this.canvas.width || 390, windowHeight: this.canvas.height || 844 };
    this.width = info.windowWidth; this.height = info.windowHeight; this.canvas.width = this.width; this.canvas.height = this.height;
    if (this.active) this.draw(clamp((this.now() - this.startAt) / this.duration));
  }
  start() {
    if (this.active || this.completed) return false;
    this.active = true; this.startAt = this.now(); this.draw(0); this.queueNext(); return true;
  }
  queueNext() { this.frame = this.schedule(() => this.tick()); }
  tick() {
    if (!this.active) return;
    const progress = clamp((this.now() - this.startAt) / this.duration); this.draw(progress);
    if (progress >= 1) this.finish(); else this.queueNext();
  }
  skip() {
    if (!this.active) return false;
    this.draw(1); this.finish(); return true;
  }
  finish() {
    if (this.completed) return;
    if (this.frame !== null) this.cancel(this.frame);
    this.frame = null; this.active = false; this.completed = true; this.onComplete();
  }
  drawCloud(x, y, radius, alpha) {
    const c = this.ctx; c.globalAlpha = alpha; c.fillStyle = "#f8fdff"; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.arc(x + radius * .72, y + 4, radius * .72, 0, Math.PI * 2); c.arc(x - radius * .65, y + 5, radius * .62, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
  drawTree(x, base, size, shade, rise) {
    const c = this.ctx; const y = base + (1 - rise) * size * .7; c.fillStyle = shade; c.beginPath(); c.moveTo(x, y - size); c.lineTo(x - size * .52, y); c.lineTo(x + size * .52, y); c.fill(); c.fillStyle = "#6a3d21"; c.fillRect(x - size * .08, y - size * .08, size * .16, size * .34);
  }
  drawTrail(reveal) {
    const c = this.ctx; const left = this.width * .2; const bottom = this.height * .88; const top = this.height * .54; c.strokeStyle = "#e6cb67"; c.lineWidth = 10; c.lineCap = "round"; c.beginPath(); c.moveTo(left, bottom); c.bezierCurveTo?.(this.width * .38, this.height * .73, this.width * .58, this.height * .72, this.width * .5, top); c.stroke();
    c.strokeStyle = "#fff4b9"; c.lineWidth = 3; c.globalAlpha = reveal; c.stroke(); c.globalAlpha = 1;
  }
  draw(progress) {
    const c = this.ctx; const sky = easeOut(progress / .36); const forest = easeOut((progress - .13) / .46); const trail = easeInOut((progress - .34) / .35); const title = easeOut((progress - .4) / .22); const brand = easeOut((progress - .67) / .18); const prompt = easeOut((progress - .78) / .16);
    c.clearRect(0, 0, this.width, this.height); c.fillStyle = "#67c8f4"; c.fillRect(0, 0, this.width, this.height);
    c.globalAlpha = sky * .9; c.fillStyle = "#b9e8ff"; c.fillRect(0, this.height * .36, this.width, this.height * .64); c.globalAlpha = 1;
    this.drawCloud(this.width * .18, this.height * .19, 28, sky * .9); this.drawCloud(this.width * .79, this.height * .29, 22, sky * .75);
    c.fillStyle = "#69a941"; c.globalAlpha = forest; c.fillRect(0, this.height * .64, this.width, this.height * .36); c.globalAlpha = 1;
    [[.08,.74,60,"#2f7e3d"],[.27,.77,78,"#358b43"],[.76,.74,75,"#2a7639"],[.92,.79,58,"#3d9548"],[.54,.8,54,"#2f7e3d"]].forEach(([x,base,size,color]) => this.drawTree(this.width * x, this.height * base, size, color, forest));
    if (trail > 0) this.drawTrail(trail);
    const centerY = this.height * .5; const titleY = centerY - 54; const englishY = centerY; const sloganY = centerY + 54; const cnFont = Math.max(36, Math.round(this.width * .108)); const enFont = Math.max(20, Math.round(this.width * .056)); const sloganFont = Math.max(19, Math.round(this.width * .052));
    c.textAlign = "center"; c.globalAlpha = title; c.fillStyle = "#fffdf2"; c.font = `700 ${cnFont}px Microsoft YaHei, sans-serif`; c.fillText("森林寻径", this.width / 2, titleY); c.fillStyle = "#3f6b32"; c.font = `700 ${enFont}px Georgia, serif`; c.fillText("FOREST TRAIL", this.width / 2, englishY); c.font = `700 ${sloganFont}px Microsoft YaHei, sans-serif`; c.fillStyle = "#f7ffe9"; c.fillText("穿过林间，找到前路", this.width / 2, sloganY); c.globalAlpha = 1;
    c.globalAlpha = brand * .88; c.fillStyle = "#f7ffe9"; c.font = "700 14px Georgia, Microsoft YaHei, serif"; c.fillText("森Studios 2026", this.width / 2, this.height - 66); c.globalAlpha = prompt * (.72 + Math.sin(progress * Math.PI * 7) * .18); c.fillStyle = "#ffffff"; c.font = "12px Microsoft YaHei, sans-serif"; c.fillText("轻触跳过", this.width / 2, this.height - 38); c.globalAlpha = 1; c.textAlign = "left";
  }
}

module.exports = { OpeningSequence };
