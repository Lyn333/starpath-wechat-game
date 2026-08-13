/** 星图档案馆设计：场景将纯规则、浏览器输入与 Babylon 可视层组合；可替换两端以迁移微信小游戏。 */
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { InputAdapter } from "./InputAdapter";
import { PathEngine } from "./PathEngine";
import { GameRenderer } from "./GameRenderer";
import type { GameSnapshot } from "./types";

export interface GameHandle {
  scene: Scene;
  dispose: () => void;
  getSnapshot: () => GameSnapshot;
  undo: () => void;
  reset: () => void;
  showHint: () => void;
}

export interface GameSceneOptions {
  onStateChange?: (snapshot: GameSnapshot) => void;
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, options: GameSceneOptions = {}): Promise<GameHandle> {
  const scene = new Scene(engine);
  const pathEngine = new PathEngine();
  const renderer = new GameRenderer(scene, canvas, pathEngine);
  const input = new InputAdapter(canvas, {
    getCellAt: (x, y) => renderer.getCellAt(x, y),
    moveTo: (cell) => pathEngine.moveTo(cell),
  });
  const unsubscribe = pathEngine.subscribe((snapshot) => {
    renderer.update(snapshot);
    options.onStateChange?.(snapshot);
  });
  scene.onBeforeRenderObservable.add(() => renderer.tick());

  const demoMode = new URLSearchParams(window.location.search).has("demo");
  let demoTimer: number | null = null;
  if (demoMode) {
    let cursor = 0;
    const playNext = () => {
      const cell = pathEngine.puzzle.solution[cursor];
      if (!cell) return;
      pathEngine.moveTo(cell);
      cursor += 1;
      demoTimer = window.setTimeout(playNext, 92);
    };
    demoTimer = window.setTimeout(playNext, 520);
  }

  return {
    scene,
    getSnapshot: () => pathEngine.getSnapshot(),
    undo: () => pathEngine.undo(),
    reset: () => pathEngine.reset(),
    showHint: () => pathEngine.showHint(),
    dispose: () => {
      if (demoTimer !== null) window.clearTimeout(demoTimer);
      unsubscribe();
      input.dispose();
      renderer.dispose();
      scene.dispose();
    },
  };
}
