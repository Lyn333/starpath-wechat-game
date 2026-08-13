/** 星图档案馆设计：Babylon 负责可见的星图、信标和光轨；坐标与输入均按触摸屏比例自适应。 */
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Layer } from "@babylonjs/core/Layers/layer";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PathEngine } from "./PathEngine";
import { sameCell, type Cell, type GameSnapshot, type Wall } from "./types";

const BACKGROUND_URL = "/manus-storage/starpath-archive-background_326814c1.png";

interface BoardLayout {
  width: number;
  height: number;
  left: number;
  top: number;
  size: number;
  cell: number;
}

const palette = {
  ivory: Color3.FromHexString("#F4E9D4"),
  ivorySoft: Color3.FromHexString("#D8CEBC"),
  indigo: Color3.FromHexString("#08152E"),
  navy: Color3.FromHexString("#122747"),
  brass: Color3.FromHexString("#C6A65C"),
  brassDeep: Color3.FromHexString("#5C4826"),
  teal: Color3.FromHexString("#57E5D0"),
  tealSoft: Color3.FromHexString("#75F1DF"),
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
  private readonly background: Layer;
  private layout: BoardLayout = { width: 0, height: 0, left: 0, top: 0, size: 0, cell: 0 };
  private lastWidth = 0;
  private lastHeight = 0;
  private snapshot: GameSnapshot;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly engine: PathEngine,
  ) {
    this.scene.clearColor = new Color4(0.02, 0.06, 0.15, 1);
    this.background = new Layer("archive-paper", BACKGROUND_URL, scene, true);
    this.camera = new FreeCamera("star-chart-camera", new Vector3(0, 0, -10), scene);
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
    this.background.dispose();
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
    const gridMaterial = this.ownStaticMaterial(material(this.scene, "grid-lines", palette.ivorySoft, 0.31));
    const cellMaterial = this.ownStaticMaterial(material(this.scene, "cell-paper", palette.navy, 0.35));
    const frameMaterial = this.ownStaticMaterial(material(this.scene, "chart-frame", palette.brass, 0.82));
    const wallMaterial = this.ownStaticMaterial(material(this.scene, "survey-wall", palette.brassDeep, 0.98));

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

    const frame = CreateBox("chart-frame", { width: size + 16, height: size + 16, depth: 1 }, this.scene);
    frame.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 2.8);
    frame.material = frameMaterial;
    this.staticMeshes.push(frame);
    const innerFrame = CreateBox("chart-frame-inner", { width: size + 6, height: size + 6, depth: 1.2 }, this.scene);
    innerFrame.position = this.toWorld({ x: this.layout.left + size / 2, y: this.layout.top + size / 2 }, 2.5);
    innerFrame.material = this.ownStaticMaterial(material(this.scene, "chart-frame-inner-material", palette.indigo, 1));
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
    const routeMaterial = this.ownDynamicMaterial(material(this.scene, "active-star-route", palette.teal, 0.97));
    if (this.snapshot.path.length === 1) {
      const disc = CreateDisc("route-origin", { radius: Math.max(6, this.layout.cell * 0.12), tessellation: 32 }, this.scene);
      disc.position = this.toWorld(this.centerOf(this.snapshot.path[0]), -3.2);
      disc.material = routeMaterial;
      this.dynamicMeshes.push(disc);
      return;
    }
    const path = this.snapshot.path.map((cell) => this.toWorld(this.centerOf(cell), -3.2));
    const tube = CreateTube("active-star-route", { path, radius: Math.max(5, this.layout.cell * 0.1), tessellation: 12, cap: 3 }, this.scene);
    tube.material = routeMaterial;
    this.dynamicMeshes.push(tube);
  }

  private createHintMarkers(): void {
    const hintMaterial = this.ownDynamicMaterial(material(this.scene, "projected-route", palette.tealSoft, 0.26));
    this.snapshot.hintCells.forEach((cell, index) => {
      const disc = CreateDisc(`hint-${index}`, { radius: this.layout.cell * 0.18, tessellation: 24 }, this.scene);
      disc.position = this.toWorld(this.centerOf(cell), -2.6);
      disc.material = hintMaterial;
      this.dynamicMeshes.push(disc);
    });
  }

  private createWaypoints(): void {
    this.engine.puzzle.waypoints.forEach((waypoint) => {
      const passed = waypoint.number < this.snapshot.nextWaypoint;
      const current = waypoint.number === this.snapshot.nextWaypoint;
      const outer = CreateDisc(`waypoint-outer-${waypoint.number}`, { radius: this.layout.cell * 0.29, tessellation: 36 }, this.scene);
      outer.position = this.toWorld(this.centerOf(waypoint.cell), -4);
      outer.material = this.ownDynamicMaterial(material(this.scene, `waypoint-brass-${waypoint.number}`, passed ? palette.teal : palette.brass, 1));
      this.dynamicMeshes.push(outer);

      const inner = CreateDisc(`waypoint-inner-${waypoint.number}`, { radius: this.layout.cell * 0.235, tessellation: 36 }, this.scene);
      inner.position = this.toWorld(this.centerOf(waypoint.cell), -4.15);
      inner.material = this.ownDynamicMaterial(material(this.scene, `waypoint-core-${waypoint.number}`, current ? palette.tealSoft : palette.indigo, 1));
      this.dynamicMeshes.push(inner);

      if (current && this.snapshot.status !== "completed") {
        const halo = CreateDisc(`waypoint-halo-${waypoint.number}`, { radius: this.layout.cell * 0.37, tessellation: 36 }, this.scene);
        halo.position = this.toWorld(this.centerOf(waypoint.cell), -3.85);
        halo.material = this.ownDynamicMaterial(material(this.scene, `waypoint-halo-${waypoint.number}`, palette.teal, 0.16));
        this.dynamicMeshes.push(halo);
      }
      this.createNumberLabel(waypoint.number, waypoint.cell, passed || current ? palette.indigo : palette.ivory);
    });
  }

  private createNumberLabel(number: number, cell: Cell, color: Color3): void {
    const texture = new DynamicTexture(`waypoint-label-${number}`, { width: 256, height: 256 }, this.scene, false);
    texture.hasAlpha = true;
    texture.drawText(String(number), 0, 182, "700 156px system-ui, sans-serif", color.toHexString(), "transparent", true);
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
    mesh.material = wallMaterial;
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
