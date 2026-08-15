/** 极简白底棋盘：Babylon 负责白色棋盘、黑色数字和明黄色路径；坐标与输入均按触摸屏比例自适应。 */
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
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

const palette = {
  paper: Color3.FromHexString("#FFFFFF"),
  paperSoft: Color3.FromHexString("#FAFAFA"),
  grid: Color3.FromHexString("#D5D5D5"),
  graphite: Color3.FromHexString("#202020"),
  charcoal: Color3.FromHexString("#4A4A4A"),
  mcdYellow: Color3.FromHexString("#FFC72C"),
  yellowLight: Color3.FromHexString("#FFD95A"),
  black: Color3.FromHexString("#111111"),
};

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
    // 使用不透明白色清屏，让Canvas与页面背景保持统一；不再依赖会触发着色器异步加载的Layer。
    this.scene.clearColor = new Color4(1, 1, 1, 1);
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
    const size = Math.min(width * 0.82, height * 0.59, 620);
    const left = (width - size) / 2;
    const top = Math.max(112, Math.min(height - size - 112, height * 0.51 - size / 2));
    this.layout = { width, height, left, top, size, cell: size / this.engine.puzzle.size };
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
    const { size, cell } = this.layout;
    const forestVeilMaterial = this.ownStaticMaterial(material(this.scene, "white-canvas-base", palette.paper, 1));
    const notebookBackingMaterial = this.ownStaticMaterial(material(this.scene, "board-backing", palette.paper, 1));
    const binderMaterial = this.ownStaticMaterial(material(this.scene, "board-accent", palette.mcdYellow, 1));
    const gridMaterial = this.ownStaticMaterial(material(this.scene, "grid-lines", palette.grid, 1));
    const cellMaterial = this.ownStaticMaterial(material(this.scene, "paper-map-cell", palette.paperSoft, 1));
    const frameMaterial = this.ownStaticMaterial(material(this.scene, "graphite-map-frame", palette.graphite, 1));
    const wallMaterial = this.ownStaticMaterial(material(this.scene, "wall", palette.charcoal, 1));

    // 以白色画布作为棋盘和界面的统一底色。
    const forestVeil = CreateBox("forest-paper-veil", { width: this.layout.width + 20, height: this.layout.height + 20, depth: 1 }, this.scene);
    forestVeil.position = this.toWorld({ x: this.layout.width / 2, y: this.layout.height / 2 }, 4.5);
    forestVeil.material = forestVeilMaterial;
    this.staticMeshes.push(forestVeil);

    // 细黑框与三枚黄色点缀建立清晰的棋盘边界，不干扰数字阅读。
    const notebookBacking = CreateBox("field-notebook-backing", { width: size + 64, height: size + 68, depth: 1 }, this.scene);
    notebookBacking.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 3.7);
    notebookBacking.material = notebookBackingMaterial;
    this.staticMeshes.push(notebookBacking);
    [0, 1, 2].forEach((index) => {
      const binder = CreateDisc(`notebook-binder-${index}`, { radius: 5.2, tessellation: 18 }, this.scene);
      binder.position = this.toWorld({ x: this.layout.left - 25, y: this.layout.top + size * 0.28 + index * size * 0.22 }, 2.7);
      binder.material = binderMaterial;
      this.staticMeshes.push(binder);
    });

    for (let row = 0; row < this.engine.puzzle.size; row += 1) {
      for (let col = 0; col < this.engine.puzzle.size; col += 1) {
        const mesh = CreateBox(`cell-${row}-${col}`, { width: cell - 3, height: cell - 3, depth: 1 }, this.scene);
        mesh.position = this.toWorld(this.centerOf({ row, col }), 2);
        mesh.material = cellMaterial;
        this.staticMeshes.push(mesh);
      }
    }

    for (let index = 0; index <= this.engine.puzzle.size; index += 1) {
      const x = this.layout.left + index * cell;
      const y = this.layout.top + index * cell;
      const vertical = CreateBox(`vertical-${index}`, { width: 1.2, height: size, depth: 1 }, this.scene);
      vertical.position = this.toWorld({ x, y: this.layout.top + size / 2 }, 0.4);
      vertical.material = gridMaterial;
      this.staticMeshes.push(vertical);
      const horizontal = CreateBox(`horizontal-${index}`, { width: size, height: 1.2, depth: 1 }, this.scene);
      horizontal.position = this.toWorld({ x: this.layout.left + size / 2, y }, 0.4);
      horizontal.material = gridMaterial;
      this.staticMeshes.push(horizontal);
    }

    const frame = CreateBox("wood-map-frame", { width: size + 16, height: size + 16, depth: 1 }, this.scene);
    frame.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 2.8);
    frame.material = frameMaterial;
    this.staticMeshes.push(frame);
    const innerFrame = CreateBox("moss-map-inner", { width: size + 6, height: size + 6, depth: 1.2 }, this.scene);
    innerFrame.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 2.5);
    innerFrame.material = this.ownStaticMaterial(material(this.scene, "paper-map-inner-material", palette.paper, 1));
    this.staticMeshes.push(innerFrame);

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
    const routeMaterial = this.ownDynamicMaterial(material(this.scene, "active-yellow-trail", palette.mcdYellow, 1));
    if (this.snapshot.path.length === 1) {
      const disc = CreateDisc("trail-origin", { radius: Math.max(6, this.layout.cell * 0.12), tessellation: 32 }, this.scene);
      disc.position = this.toWorld(this.centerOf(this.snapshot.path[0]), -3.2);
      disc.material = routeMaterial;
      this.dynamicMeshes.push(disc);
      return;
    }
    const path = this.snapshot.path.map((cell) => this.toWorld(this.centerOf(cell), -3.2));
    const tube = CreateTube("active-forest-trail", { path, radius: Math.max(5, this.layout.cell * 0.1), tessellation: 12, cap: 3 }, this.scene);
    tube.material = routeMaterial;
    this.dynamicMeshes.push(tube);
    this.snapshot.path.slice(1).forEach((cell, index) => {
      const footprint = CreateDisc(`footprint-${index}`, { radius: Math.max(3.4, this.layout.cell * 0.064), tessellation: 16 }, this.scene);
      footprint.scaling.set(0.62, 1.32, 1);
      footprint.rotation.z = index % 2 === 0 ? 0.34 : -0.34;
      footprint.position = this.toWorld(this.centerOf(cell), -4.05);
      footprint.material = this.ownDynamicMaterial(material(this.scene, `footprint-yellow-${index}`, palette.yellowLight, 1));
      this.dynamicMeshes.push(footprint);
    });
  }

  private createHintMarkers(): void {
    const hintMaterial = this.ownDynamicMaterial(material(this.scene, "yellow-trail-hint", palette.mcdYellow, 0.42));
    this.snapshot.hintCells.forEach((cell, index) => {
      const tile = CreateBox(`hint-${index}`, { width: this.layout.cell * 0.64, height: this.layout.cell * 0.64, depth: 0.35 }, this.scene);
      tile.position = this.toWorld(this.centerOf(cell), -3.55);
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
    texture.drawText(String(number), 0, 182, "700 156px system-ui, sans-serif", palette.black.toHexString(), "transparent", true);
    const labelMaterial = this.ownDynamicMaterial(new StandardMaterial(`waypoint-label-material-${number}`, this.scene));
    labelMaterial.disableLighting = true;
    labelMaterial.diffuseTexture = texture;
    labelMaterial.emissiveColor = Color3.White();
    labelMaterial.opacityTexture = texture;
    const label = CreatePlane(`waypoint-label-${number}`, { size: 1 }, this.scene);
    const labelSize = this.layout.cell * 0.43;
    label.scaling.set(labelSize, labelSize, 1);
    label.position = this.toWorld(this.centerOf(cell), -4.4);
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
      { width: isHorizontal ? cell * 0.8 : 7, height: isHorizontal ? 7 : cell * 0.8, depth: 2 },
      this.scene,
    );
    mesh.position = this.toWorld({ x, y }, -1.8);
    mesh.rotation.z = isHorizontal ? (index % 2 === 0 ? 0.035 : -0.035) : (index % 2 === 0 ? 0.035 : -0.035);
    mesh.material = wallMaterial;
    const logCap = CreateDisc(`fallen-log-cap-${index}`, { radius: 5.1, tessellation: 16 }, this.scene);
    logCap.position = this.toWorld({ x: x + (isHorizontal ? -cell * 0.33 : 0), y: y + (isHorizontal ? 0 : cell * 0.33) }, -2.1);
    logCap.material = wallMaterial;
    this.staticMeshes.push(logCap);
    return mesh;
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

  private ownDynamicMaterial<T extends Material>(value: T): T {
    this.dynamicMaterials.push(value);
    return value;
  }

  private disposeStatic(): void {
    this.staticMeshes.splice(0).forEach((mesh) => mesh.dispose());
    this.staticMaterials.splice(0).forEach((item) => item.dispose());
  }

  private disposeDynamic(): void {
    this.dynamicMeshes.splice(0).forEach((mesh) => mesh.dispose());
    this.dynamicMaterials.splice(0).forEach((item) => item.dispose());
    this.dynamicTextures.splice(0).forEach((item) => item.dispose());
  }
}
