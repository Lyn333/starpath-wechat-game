/** 极简白底棋盘：Babylon 负责白色棋盘、黑色数字和明黄色路径；坐标与输入均按触摸屏比例自适应。 */
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PathEngine } from "./PathEngine";
import { sameCell, type Cell, type GameSnapshot, type Wall } from "./types";

interface BoardLayout {
  width: number;
  height: number;
  left: number;
  top: number;
  size: number;
  cell: number;
}

// 平台冒险灵感调色：天空、金币、蘑菇红、草地与砖块；不使用外部游戏素材或标志。
const palette = {
  skyBlue: Color3.FromHexString("#64B9ED"),
  brickBrown: Color3.FromHexString("#7B321E"),
  pathGreen: Color3.FromHexString("#26D953"),
  grassGreen: Color3.FromHexString("#35A853"),
  black: Color3.FromHexString("#1A1714"),
};
const BOARD_FRAME_BLEED = 20;

function material(scene: Scene, name: string, color: Color3, alpha = 1): StandardMaterial {
  const output = new StandardMaterial(name, scene);
  output.disableLighting = true;
  output.emissiveColor = color;
  output.diffuseColor = color;
  output.alpha = alpha;
  return output;
}

export class GameRenderer {
  private readonly camera: FreeCamera;
  private readonly staticMeshes: AbstractMesh[] = [];
  private readonly staticMaterials: Material[] = [];
  private readonly staticTextures: Texture[] = [];
  private readonly dynamicMeshes: AbstractMesh[] = [];
  private readonly dynamicMaterials: Material[] = [];
  private readonly dynamicTextures: Texture[] = [];
  private layout: BoardLayout = { width: 0, height: 0, left: 0, top: 0, size: 0, cell: 0 };
  private lastWidth = 0;
  private lastHeight = 0;
  private snapshot: GameSnapshot;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly engine: PathEngine,
  ) {
    // 使用天空蓝清屏，让Canvas与页面背景保持统一；不再依赖会触发着色器异步加载的Layer。
    this.scene.clearColor = new Color4(0.392, 0.725, 0.929, 1);
    this.camera = new FreeCamera("forest-trail-camera", new Vector3(0, 0, -10), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.snapshot = engine.getSnapshot();
    this.applyLayout();
    this.rebuildStatic();
    this.rebuildDynamic();
  }

  update(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    this.rebuildDynamic();
  }

  tick(): void {
    if (window.innerWidth !== this.lastWidth || window.innerHeight !== this.lastHeight) {
      this.applyLayout();
      this.rebuildStatic();
      this.rebuildDynamic();
    }
  }

  getCellAt(clientX: number, clientY: number): Cell | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.layout.width;
    const y = ((clientY - rect.top) / rect.height) * this.layout.height;
    if (x < this.layout.left || y < this.layout.top || x > this.layout.left + this.layout.size || y > this.layout.top + this.layout.size) return null;
    return {
      row: Math.min(this.engine.puzzle.size - 1, Math.floor((y - this.layout.top) / this.layout.cell)),
      col: Math.min(this.engine.puzzle.size - 1, Math.floor((x - this.layout.left) / this.layout.cell)),
    };
  }

  dispose(): void {
    this.disposeStatic();
    this.disposeDynamic();
    this.camera.dispose();
  }

  private applyLayout(): void {
    const width = Math.max(window.innerWidth, 320);
    const height = Math.max(window.innerHeight, 480);
    const isCompact = width < 700;
    const size = Math.min(width * (isCompact ? 0.72 : 0.42), height * 0.57, 540);
    const left = (width - size) / 2;
    const footerSpace = isCompact ? 236 : 140;
    const top = Math.max(90, Math.min(height - size - footerSpace, height * 0.12));
    this.layout = { width, height, left, top, size, cell: size / this.engine.puzzle.size };
    const visibleBoardBottom = top + size + BOARD_FRAME_BLEED / 2;
    this.canvas.parentElement?.style.setProperty("--actual-board-bottom", `${Math.round(visibleBoardBottom)}px`);
    this.lastWidth = width;
    this.lastHeight = height;
    this.camera.position.set(width / 2, height / 2, -10);
    this.camera.setTarget(new Vector3(width / 2, height / 2, 0));
    // Babylon 的正交边界以相机为原点；使用对称投影，世界坐标仍保留为屏幕像素坐标。
    this.camera.orthoLeft = -width / 2;
    this.camera.orthoRight = width / 2;
    this.camera.orthoTop = height / 2;
    this.camera.orthoBottom = -height / 2;
  }

  private rebuildStatic(): void {
    this.disposeStatic();
    const { size } = this.layout;
    const forestVeilMaterial = this.ownStaticMaterial(material(this.scene, "sky-canvas-base", palette.skyBlue, 1));
    const wallMaterial = this.ownStaticMaterial(material(this.scene, "brick-wall", palette.brickBrown, 1));

    // 以天空蓝画布和奶油棋盘形成高对比的轻量平台冒险视觉。
    const forestVeil = CreateBox("forest-paper-veil", { width: this.layout.width + 20, height: this.layout.height + 20, depth: 1 }, this.scene);
    forestVeil.position = this.toWorld({ x: this.layout.width / 2, y: this.layout.height / 2 }, 4.5);
    forestVeil.material = forestVeilMaterial;
    this.staticMeshes.push(forestVeil);

    const boardSurface = CreatePlane("rounded-grid-board", { size: 1 }, this.scene);
    boardSurface.scaling.set(size + BOARD_FRAME_BLEED, size + BOARD_FRAME_BLEED, 1);
    boardSurface.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 2.8);
    boardSurface.renderingGroupId = 0;
    boardSurface.material = this.createRoundedBoardMaterial();
    this.staticMeshes.push(boardSurface);

    this.engine.puzzle.walls.forEach((wall, index) => {
      const mesh = this.createWall(wall, index, wallMaterial);
      this.staticMeshes.push(mesh);
    });
  }

  private rebuildDynamic(): void {
    this.disposeDynamic();
    this.createHintMarkers();
    this.createPath();
    this.createWaypoints();
  }

  private createPath(): void {
    if (this.snapshot.path.length === 0) return;
    const routeMaterial = this.ownDynamicMaterial(material(this.scene, "active-bright-green-trail", palette.pathGreen, 1));
    const routeRadius = Math.max(9, this.layout.cell * 0.17);
    const routeDepth = -3.7;
    if (this.snapshot.path.length === 1) {
      const disc = CreateDisc("trail-origin", { radius: routeRadius, tessellation: 32 }, this.scene);
      disc.position = this.toWorld(this.centerOf(this.snapshot.path[0]), routeDepth);
      disc.renderingGroupId = 1;
      disc.material = routeMaterial;
      this.dynamicMeshes.push(disc);
      return;
    }
    const points = this.snapshot.path.map((cell) => this.toWorld(this.centerOf(cell), routeDepth));
    points.forEach((point, index) => {
      const joint = CreateDisc(`active-solid-joint-${index}`, { radius: routeRadius, tessellation: 32 }, this.scene);
      joint.position = point;
      joint.renderingGroupId = 1;
      joint.material = routeMaterial;
      this.dynamicMeshes.push(joint);
    });
    points.slice(1).forEach((point, index) => {
      const previous = points[index];
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const segment = CreateBox(`active-solid-segment-${index}`, { width: Math.hypot(dx, dy), height: routeRadius * 2, depth: 0.42 }, this.scene);
      segment.position = new Vector3((point.x + previous.x) / 2, (point.y + previous.y) / 2, routeDepth);
      segment.rotation.z = Math.atan2(dy, dx);
      segment.renderingGroupId = 1;
      segment.material = routeMaterial;
      this.dynamicMeshes.push(segment);
    });
  }

  private createHintMarkers(): void {
    const hintMaterial = this.ownDynamicMaterial(material(this.scene, "grass-trail-hint", palette.grassGreen, 0.52));
    this.snapshot.hintCells.forEach((cell, index) => {
      const tile = CreateBox(`hint-${index}`, { width: this.layout.cell * 0.64, height: this.layout.cell * 0.64, depth: 0.35 }, this.scene);
      tile.position = this.toWorld(this.centerOf(cell), -3.55);
      tile.renderingGroupId = 1;
      tile.material = hintMaterial;
      this.dynamicMeshes.push(tile);
    });
  }

  private createWaypoints(): void {
    this.engine.puzzle.waypoints.forEach((waypoint) => {
      this.createNumberLabel(waypoint.number, waypoint.cell);
    });
  }

  private createNumberLabel(number: number, cell: Cell): void {
    const texture = new DynamicTexture(`waypoint-label-${number}`, { width: 256, height: 256 }, this.scene, false);
    texture.hasAlpha = true;
    const context = texture.getContext();
    const textContext = context as unknown as { textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline };
    textContext.textAlign = "center";
    textContext.textBaseline = "middle";
    texture.drawText(String(number), 128, 128, '700 156px "Microsoft YaHei", "微软雅黑", sans-serif', palette.black.toHexString(), "transparent", true);
    const labelMaterial = this.ownDynamicMaterial(new StandardMaterial(`waypoint-label-material-${number}`, this.scene));
    labelMaterial.disableLighting = true;
    labelMaterial.diffuseTexture = texture;
    labelMaterial.emissiveColor = Color3.White();
    labelMaterial.opacityTexture = texture;
    const label = CreatePlane(`waypoint-label-${number}`, { size: 1 }, this.scene);
    const labelSize = this.layout.cell * 0.43;
    label.scaling.set(labelSize, labelSize, 1);
    label.position = this.toWorld(this.centerOf(cell), -4.4);
    label.renderingGroupId = 2;
    label.material = labelMaterial;
    this.dynamicMeshes.push(label);
    this.dynamicTextures.push(texture);
  }

  private createWall(wall: Wall, index: number, wallMaterial: StandardMaterial): AbstractMesh {
    const { cell } = this.layout;
    const isHorizontal = wall.direction === "up" || wall.direction === "down";
    const x = this.layout.left + wall.cell.col * cell + cell / 2 + (wall.direction === "right" ? cell / 2 : wall.direction === "left" ? -cell / 2 : 0);
    const y = this.layout.top + wall.cell.row * cell + cell / 2 + (wall.direction === "down" ? cell / 2 : wall.direction === "up" ? -cell / 2 : 0);
    const mesh = CreateBox(
      `wall-${index}`,
      { width: isHorizontal ? cell * 0.92 : 7, height: isHorizontal ? 7 : cell * 0.92, depth: 2 },
      this.scene,
    );
    mesh.position = this.toWorld({ x, y }, -1.8);
    mesh.material = wallMaterial;
    return mesh;
  }

  private createRoundedBoardMaterial(): StandardMaterial {
    const texture = this.ownStaticTexture(new DynamicTexture("rounded-grid-board-texture", { width: 1024, height: 1024 }, this.scene, false));
    texture.hasAlpha = true;
    const context = texture.getContext();
    const padding = 30;
    const boardSize = 1024 - padding * 2;
    const radius = 34;

    context.clearRect(0, 0, 1024, 1024);
    this.drawRoundedRect(context, padding, padding, boardSize, boardSize, radius);
    context.fillStyle = "#FFF4BE";
    context.fill();
    context.lineWidth = 10;
    context.strokeStyle = "#D9483B";
    context.stroke();

    context.save();
    this.drawRoundedRect(context, padding, padding, boardSize, boardSize, radius);
    context.clip();
    context.strokeStyle = "#D8B968";
    context.lineWidth = 3;
    for (let index = 1; index < this.engine.puzzle.size; index += 1) {
      const offset = padding + (boardSize / this.engine.puzzle.size) * index;
      context.beginPath();
      context.moveTo(offset, padding);
      context.lineTo(offset, padding + boardSize);
      context.stroke();
      context.beginPath();
      context.moveTo(padding, offset);
      context.lineTo(padding + boardSize, offset);
      context.stroke();
    }
    context.restore();
    texture.update();

    const output = this.ownStaticMaterial(new StandardMaterial("rounded-grid-board-material", this.scene));
    output.disableLighting = true;
    output.disableDepthWrite = true;
    output.diffuseTexture = texture;
    output.opacityTexture = texture;
    output.emissiveColor = Color3.White();
    return output;
  }

  private drawRoundedRect(context: ICanvasRenderingContext, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  private centerOf(cell: Cell): { x: number; y: number } {
    return { x: this.layout.left + cell.col * this.layout.cell + this.layout.cell / 2, y: this.layout.top + cell.row * this.layout.cell + this.layout.cell / 2 };
  }

  private toWorld(point: { x: number; y: number }, z: number): Vector3 {
    return new Vector3(point.x, this.layout.height - point.y, z);
  }

  private ownStaticMaterial<T extends Material>(value: T): T {
    this.staticMaterials.push(value);
    return value;
  }

  private ownStaticTexture<T extends Texture>(value: T): T {
    this.staticTextures.push(value);
    return value;
  }

  private ownDynamicMaterial<T extends Material>(value: T): T {
    this.dynamicMaterials.push(value);
    return value;
  }

  private disposeStatic(): void {
    this.staticMeshes.splice(0).forEach((mesh) => mesh.dispose());
    this.staticMaterials.splice(0).forEach((item) => item.dispose());
    this.staticTextures.splice(0).forEach((item) => item.dispose());
  }

  private disposeDynamic(): void {
    this.dynamicMeshes.splice(0).forEach((mesh) => mesh.dispose());
    this.dynamicMaterials.splice(0).forEach((item) => item.dispose());
    this.dynamicTextures.splice(0).forEach((item) => item.dispose());
  }
}
