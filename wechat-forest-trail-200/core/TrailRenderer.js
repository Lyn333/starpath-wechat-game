/** 林下探险手册绘制器：基于微信小游戏 Canvas 2D API，所有坐标均为逻辑像素。 */

class TrailRenderer {
  constructor(canvas, level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.level = level;
    this.layout = null;
    this.controls = [];
    this.resize();
  }

  resize() {
    const info = wx.getWindowInfo();
    this.width = info.windowWidth;
    this.height = info.windowHeight;
    this.dpr = Math.min(info.pixelRatio || 1, 3);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
    this.layout = this.computeLayout();
  }

  computeLayout() {
    const padding = 20;
    const headerHeight = 132;
    const footerHeight = 124;
    const boardAvailableHeight = Math.max(200, this.height - headerHeight - footerHeight);
    const cell = Math.floor(Math.min((this.width - padding * 2) / this.level.cols, boardAvailableHeight / this.level.rows));
    const boardWidth = cell * this.level.cols;
    const boardHeight = cell * this.level.rows;
    return {
      cell,
      boardWidth,
      boardHeight,
      left: Math.round((this.width - boardWidth) / 2),
      top: Math.round(headerHeight + Math.max(0, (boardAvailableHeight - boardHeight) * 0.32)),
    };
  }

  render(snapshot) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    this.drawHeader(snapshot);
    this.drawNotebook();
    this.drawCells();
    this.drawWalls();
    this.drawHint(snapshot);
    this.drawTrail(snapshot);
    this.drawWaypoints(snapshot);
    this.drawMessage(snapshot);
    this.drawControls(snapshot);
    if (snapshot.status === "completed") this.drawCompletion(snapshot);
  }

  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#0B2217");
    gradient.addColorStop(1, "#102D20");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "rgba(141,203,145,0.06)";
    for (let index = 0; index < 30; index += 1) {
      const x = (index * 61) % this.width;
      const y = 40 + ((index * 83) % Math.max(1, this.height - 80));
      ctx.beginPath();
      ctx.arc(x, y, 1 + (index % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHeader(snapshot) {
    const ctx = this.ctx;
    ctx.fillStyle = "#F4EFD9";
    ctx.font = "600 22px serif";
    ctx.fillText("森林寻径", 22, 40);
    ctx.fillStyle = "#D4BD7A";
    ctx.font = "10px monospace";
    ctx.fillText("FOREST TRAIL NOTES", 23, 59);
    ctx.fillStyle = "rgba(244,239,217,0.62)";
    ctx.font = "10px monospace";
    ctx.fillText("苔影林地 · 01", 22, 93);
    ctx.fillText(`脚印 ${String(snapshot.moves).padStart(2, "0")}`, this.width - 88, 40);
    ctx.fillStyle = "#E2AF52";
    ctx.fillText(`下一路标 ${snapshot.nextWaypoint}`, this.width - 100, 60);
    ctx.strokeStyle = "rgba(226,175,82,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 108);
    ctx.lineTo(this.width - 20, 108);
    ctx.stroke();
  }

  drawNotebook() {
    const { left, top, boardWidth, boardHeight } = this.layout;
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(51,38,24,0.8)";
    ctx.fillRect(left - 16, top - 16, boardWidth + 32, boardHeight + 32);
    ctx.fillStyle = "#143526";
    ctx.fillRect(left - 8, top - 8, boardWidth + 16, boardHeight + 16);
    ctx.strokeStyle = "rgba(212,189,122,0.48)";
    ctx.strokeRect(left - 8, top - 8, boardWidth + 16, boardHeight + 16);
    ctx.fillStyle = "#745438";
    [0.26, 0.5, 0.74].forEach((fraction) => {
      ctx.beginPath();
      ctx.arc(left - 13, top + boardHeight * fraction, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawCells() {
    const { left, top, cell } = this.layout;
    const ctx = this.ctx;
    ctx.fillStyle = "#183B2A";
    ctx.fillRect(left, top, this.layout.boardWidth, this.layout.boardHeight);
    ctx.strokeStyle = "rgba(217,231,200,0.28)";
    ctx.lineWidth = 1;
    for (let row = 0; row <= this.level.rows; row += 1) {
      ctx.beginPath();
      ctx.moveTo(left, top + row * cell);
      ctx.lineTo(left + this.layout.boardWidth, top + row * cell);
      ctx.stroke();
    }
    for (let col = 0; col <= this.level.cols; col += 1) {
      ctx.beginPath();
      ctx.moveTo(left + col * cell, top);
      ctx.lineTo(left + col * cell, top + this.layout.boardHeight);
      ctx.stroke();
    }
  }

  drawWalls() {
    const ctx = this.ctx;
    const { left, top, cell } = this.layout;
    ctx.strokeStyle = "#513723";
    ctx.lineWidth = Math.max(4, cell * 0.09);
    ctx.lineCap = "round";
    this.level.walls.forEach((wall) => {
      const [orientation, first, second] = wall.split("_");
      const row = Number(first);
      const col = Number(second);
      ctx.beginPath();
      if (orientation === "H") {
        const y = top + (row + 1) * cell;
        ctx.moveTo(left + col * cell + cell * 0.18, y);
        ctx.lineTo(left + (col + 1) * cell - cell * 0.18, y);
      } else {
        const x = left + (col + 1) * cell;
        ctx.moveTo(x, top + row * cell + cell * 0.18);
        ctx.lineTo(x, top + (row + 1) * cell - cell * 0.18);
      }
      ctx.stroke();
    });
  }

  drawHint(snapshot) {
    if (!snapshot.hintCells.length) return;
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(192,228,172,0.18)";
    snapshot.hintCells.forEach((cell) => {
      const rect = this.cellRect(cell);
      ctx.fillRect(rect.x + 2, rect.y + 2, rect.size - 4, rect.size - 4);
    });
  }

  drawTrail(snapshot) {
    if (!snapshot.path.length) return;
    const ctx = this.ctx;
    ctx.strokeStyle = "#E2AF52";
    ctx.lineWidth = Math.max(6, this.layout.cell * 0.13);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    snapshot.path.forEach((cell, index) => {
      const point = this.centerOf(cell);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.fillStyle = "#F2CB7A";
    snapshot.path.slice(1).forEach((cell, index) => {
      const point = this.centerOf(cell);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(index % 2 ? 0.32 : -0.32);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(2.5, this.layout.cell * 0.042), Math.max(4, this.layout.cell * 0.07), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawWaypoints(snapshot) {
    const ctx = this.ctx;
    this.level.waypoints.forEach((waypoint) => {
      const point = this.centerOf(waypoint.cell);
      const passed = waypoint.number < snapshot.nextWaypoint;
      const current = waypoint.number === snapshot.nextWaypoint;
      const radius = Math.max(12, this.layout.cell * 0.28);
      ctx.fillStyle = passed ? "#8DCB91" : "#E2AF52";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#745438";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = current ? "#C0E4AC" : "#0E241A";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F4EFD9";
      ctx.font = `700 ${Math.max(12, this.layout.cell * 0.22)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(waypoint.number), point.x, point.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
  }

  drawMessage(snapshot) {
    const ctx = this.ctx;
    const y = this.layout.top + this.layout.boardHeight + 38;
    ctx.fillStyle = "#8DCB91";
    ctx.beginPath();
    ctx.arc(this.width / 2 - 124, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244,239,217,0.82)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(snapshot.message, this.width / 2 + 8, y);
    ctx.textAlign = "left";
  }

  drawControls(snapshot) {
    const ctx = this.ctx;
    const gap = 2;
    const width = Math.min(this.width - 40, 360);
    const left = Math.round((this.width - width) / 2);
    const top = this.height - 62;
    const height = 44;
    const itemWidth = (width - gap * 2) / 3;
    const controls = [
      { id: "undo", label: "踏回一步", active: snapshot.path.length > 0 && snapshot.status !== "completed" },
      { id: "hint", label: "叶径提示", active: snapshot.status !== "completed" },
      { id: "reset", label: "重新入林", active: true },
    ];
    this.controls = controls.map((control, index) => ({ ...control, x: left + index * (itemWidth + gap), y: top, width: itemWidth, height }));
    this.controls.forEach((control) => {
      ctx.fillStyle = control.id === "hint" ? "#E2AF52" : "rgba(53,39,25,0.9)";
      if (!control.active) ctx.fillStyle = "rgba(38,45,36,0.78)";
      ctx.fillRect(control.x, control.y, control.width, control.height);
      ctx.strokeStyle = "rgba(226,175,82,0.68)";
      ctx.strokeRect(control.x, control.y, control.width, control.height);
      ctx.fillStyle = control.id === "hint" ? "#173725" : (control.active ? "#F4EFD9" : "rgba(244,239,217,0.28)");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 11px sans-serif";
      ctx.fillText(control.label, control.x + control.width / 2, control.y + control.height / 2 + 1);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawCompletion(snapshot) {
    const ctx = this.ctx;
    const width = Math.min(this.width - 52, 330);
    const height = 176;
    const left = (this.width - width) / 2;
    const top = (this.height - height) / 2;
    ctx.fillStyle = "rgba(7,20,13,0.78)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#173725";
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = "#E2AF52";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = "#8DCB91";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("FIELD LOG · VERIFIED", this.width / 2, top + 35);
    ctx.fillStyle = "#F4EFD9";
    ctx.font = "600 28px serif";
    ctx.fillText("林径已走通", this.width / 2, top + 77);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(244,239,217,0.78)";
    ctx.fillText(`共留下 ${snapshot.moves} 枚脚印`, this.width / 2, top + 108);
    ctx.fillStyle = "#E2AF52";
    ctx.fillText("点击“重新入林”再次挑战", this.width / 2, top + 138);
    ctx.textAlign = "left";
  }

  toCell(point) {
    const { left, top, cell, boardWidth, boardHeight } = this.layout;
    if (point.x < left || point.x >= left + boardWidth || point.y < top || point.y >= top + boardHeight) return null;
    return { row: Math.floor((point.y - top) / cell), col: Math.floor((point.x - left) / cell) };
  }

  hitControl(point) {
    return this.controls.find((control) => point.x >= control.x && point.x <= control.x + control.width && point.y >= control.y && point.y <= control.y + control.height && control.active)?.id || null;
  }

  centerOf(cell) {
    const rect = this.cellRect(cell);
    return { x: rect.x + rect.size / 2, y: rect.y + rect.size / 2 };
  }

  cellRect(cell) {
    return { x: this.layout.left + cell.col * this.layout.cell, y: this.layout.top + cell.row * this.layout.cell, size: this.layout.cell };
  }
}

module.exports = { TrailRenderer };
