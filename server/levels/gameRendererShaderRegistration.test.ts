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

  it("uses a white board, McDonald's-style yellow path, and black numbers without marker rings", () => {
    expect(rendererSource).toContain('mcdYellow: Color3.FromHexString("#FFC72C")');
    expect(rendererSource).toContain('material(this.scene, "active-yellow-trail", palette.mcdYellow, 1)');
    expect(rendererSource).toContain('palette.black.toHexString()');
    expect(rendererSource).toContain('CreateBox(`hint-${index}`');
    expect(rendererSource).not.toContain("waypoint-outer-");
    expect(rendererSource).not.toContain("waypoint-growth-ring-");
  });
});
