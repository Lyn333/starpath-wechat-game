import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererSource = readFileSync(path.resolve(import.meta.dirname, "../../client/src/game/GameRenderer.ts"), "utf8");

describe("GameRenderer shader registration", () => {
  it("registers the StandardMaterial GLSL source instead of relying on Vite fallback loading", () => {
    expect(rendererSource).toContain('import "@babylonjs/core/Shaders/default.vertex";');
    expect(rendererSource).toContain('import "@babylonjs/core/Shaders/default.fragment";');
  });

  it("uses the CSS backdrop instead of the Layer shader path", () => {
    expect(rendererSource).not.toContain("@babylonjs/core/Layers/layer");
    expect(rendererSource).not.toContain("new Layer(");
  });

  it("uses a platform-adventure palette with sky, bright-green path, brick walls, and centered black numbers without marker rings", () => {
    expect(rendererSource).toContain('skyBlue: Color3.FromHexString("#64B9ED")');
    expect(rendererSource).toContain('pathGreen: Color3.FromHexString("#26D953")');
    expect(rendererSource).toContain('brickBrown: Color3.FromHexString("#7B321E")');
    expect(rendererSource).toContain('grassGreen: Color3.FromHexString("#35A853")');
    expect(rendererSource).toContain('material(this.scene, "active-bright-green-trail", palette.pathGreen, 1)');
    expect(rendererSource).toContain('palette.black.toHexString()');
    expect(rendererSource).toContain('textContext.textAlign = "center"');
    expect(rendererSource).toContain('textContext.textBaseline = "middle"');
    expect(rendererSource).toContain('"Microsoft YaHei", "微软雅黑"');
    expect(rendererSource).toContain('new DynamicTexture("rounded-grid-board-texture"');
    expect(rendererSource).toContain('output.disableDepthWrite = true');
    expect(rendererSource).toContain('CreateBox(`active-solid-segment-${index}`');
    expect(rendererSource).toContain('CreateDisc(`active-solid-joint-${index}`');
    expect(rendererSource).toContain('CreateBox(`hint-${index}`');
    expect(rendererSource).not.toContain("footprint-yellow-");
    expect(rendererSource).not.toContain("waypoint-outer-");
    expect(rendererSource).not.toContain("waypoint-growth-ring-");
  });
});
