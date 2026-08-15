import type { ForestGridSize } from "./levelBundle";
import type { PathEngine } from "./PathEngine";

export function getDemoGrid(search: string): ForestGridSize | null {
  const demo = new URLSearchParams(search).get("demo");
  if (demo === "8") return "8x8";
  if (demo === "10") return "10x10";
  if (demo === "12") return "12x12";
  return null;
}

export function getDemoStepMs(search: string): number {
  return new URLSearchParams(search).get("demoSpeed") === "fast" ? 2 : 92;
}

export function startDemoPlayback(pathEngine: PathEngine, enabled: boolean, stepMs: number, initialDelayMs = 520): () => void {
  if (!enabled) return () => undefined;
  let cursor = 0;
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  const playNext = () => {
    const cell = pathEngine.puzzle.solution[cursor];
    if (!cell) return;
    pathEngine.moveTo(cell);
    cursor += 1;
    timer = globalThis.setTimeout(playNext, stepMs);
  };
  timer = globalThis.setTimeout(playNext, initialDelayMs);
  return () => { if (timer !== null) globalThis.clearTimeout(timer); };
}
